import type { FinanceEvent } from "@/lib/events/types";
import { normalizeBillCategory } from "@/lib/finance/billCategories";
import { getPrimaryCashAccount } from "@/lib/finance/cashAccount";
import { getCurrentYearMonth } from "@/lib/finance/bills";
import { emptyFinanceData } from "@/lib/finance/emptyFinanceData";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";
import { buildUpdatedIncomeSource } from "@/lib/finance/income";
import { buildUpdatedDebt } from "@/lib/finance/debts";
import type {
  AddAccountInput,
  AddBillInput,
  AddDebtInput,
  AddIncomeInput,
  AddMoneyToGoalInput,
  CreateGoalInput,
  EditBillInput,
  EditDebtInput,
  EditGoalInput,
  EditIncomeInput,
  FinanceData,
  Transaction,
} from "@/lib/finance/types";
import { applyActivityToData } from "@/lib/recurring/applyActivity";
import { normalizeIncomeFrequency } from "@/lib/recurring/frequencies";
import {
  normalizeRecurringFinanceData,
  serializeSchedule,
} from "@/lib/recurring/normalize";
import { createSchedule } from "@/lib/recurring/schedule";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import type { BudgetOsSupabaseClient } from "@/lib/supabase/client";
import {
  buildBillUpdate,
  buildDebtInsert,
  buildDebtUpdate,
  buildGoalUpdate,
  buildIncomeUpdate,
  buildInvestmentUpdate,
  buildTransactionInsert,
  buildTransactionUpdate,
  mapFinanceData,
} from "@/lib/supabase/mappers";
import { NotificationsRepository } from "@/lib/supabase/repositories/notificationsRepository";
import { ProfilesRepository } from "@/lib/supabase/repositories/profilesRepository";
import { RecurringItemsRepository } from "@/lib/supabase/repositories/recurringItemsRepository";
import { seedFinanceData } from "@/lib/supabase/seed";
import type { OnboardingState } from "@/lib/onboarding/types";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while syncing with Supabase.";
}

export class FinanceService {
  private readonly notifications: NotificationsRepository;
  private readonly profiles: ProfilesRepository;
  private readonly recurringItems: RecurringItemsRepository;

  constructor(private readonly supabase: BudgetOsSupabaseClient) {
    this.notifications = new NotificationsRepository(supabase);
    this.profiles = new ProfilesRepository(supabase);
    this.recurringItems = new RecurringItemsRepository(supabase);
  }

  async getUserId(): Promise<string> {
    return requireAuthenticatedUser(this.supabase);
  }

  async loadFinanceData(userId: string): Promise<FinanceData> {
    const [
      accountsResult,
      billsResult,
      goalsResult,
      transactionsResult,
      investmentsResult,
      events,
    ] = await Promise.all([
      this.supabase.from("accounts").select("*").eq("user_id", userId),
      this.supabase.from("bills").select("*").eq("user_id", userId),
      this.supabase.from("goals").select("*").eq("user_id", userId),
      this.supabase.from("transactions").select("*").eq("user_id", userId),
      this.supabase.from("investments").select("*").eq("user_id", userId),
      this.notifications.loadEvents(userId),
    ]);

    if (accountsResult.error) throw accountsResult.error;
    if (billsResult.error) throw billsResult.error;
    if (goalsResult.error) throw goalsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;

    if (investmentsResult.error) {
      // Table may not exist until migration runs — fall back to legacy accounts rows.
      if (!investmentsResult.error.message.includes("investments")) {
        throw investmentsResult.error;
      }
    }

    return mapFinanceData(
      accountsResult.data ?? [],
      billsResult.data ?? [],
      goalsResult.data ?? [],
      transactionsResult.data ?? [],
      investmentsResult.data ?? [],
      events,
    );
  }

  async saveEvents(userId: string, events: FinanceEvent[]): Promise<void> {
    await this.notifications.saveEvents(userId, events);
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.notifications.markRead(userId, notificationId);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notifications.markAllRead(userId);
  }

  async loadOnboardingState(userId: string): Promise<OnboardingState> {
    return this.profiles.loadOnboardingState(userId);
  }

  async saveOnboardingState(
    userId: string,
    state: OnboardingState,
  ): Promise<void> {
    await this.profiles.saveOnboardingState(userId, state);
  }

  async replaceFinanceData(userId: string, data: FinanceData): Promise<FinanceData> {
    const deleteResults = await Promise.all([
      this.supabase.from("accounts").delete().eq("user_id", userId),
      this.supabase.from("bills").delete().eq("user_id", userId),
      this.supabase.from("goals").delete().eq("user_id", userId),
      this.supabase.from("transactions").delete().eq("user_id", userId),
      this.supabase.from("investments").delete().eq("user_id", userId),
      this.supabase.from("notifications").delete().eq("user_id", userId),
      this.supabase.from("recurring_items").delete().eq("user_id", userId),
    ]);

    const deleteError = deleteResults.find((result) => result.error)?.error;

    if (deleteError) {
      throw deleteError;
    }

    await seedFinanceData(this.supabase, userId, data);
    return this.loadFinanceData(userId);
  }

  async createAccount(
    userId: string,
    input: AddAccountInput,
    id?: string,
  ): Promise<FinanceData> {
    const { error } = await this.supabase.from("accounts").insert({
      ...(id ? { id } : {}),
      user_id: userId,
      record_kind: "account",
      name: input.name.trim(),
      institution: input.institution.trim(),
      type: input.type,
      balance: input.balance,
      monthly_change: 0,
      interest_rate: null,
      minimum_payment: null,
      monthly_contribution: null,
    });

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async createIncome(
    userId: string,
    input: AddIncomeInput,
    id?: string,
  ): Promise<FinanceData> {
    const frequency = normalizeIncomeFrequency(input.frequency);
    const referenceDate = new Date();
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - 120);
    const schedule = createSchedule(startDate, frequency, referenceDate);

    const { error } = await this.supabase.from("transactions").insert({
      ...(id ? { id } : {}),
      user_id: userId,
      transaction_type: "income",
      name: input.name.trim(),
      amount: input.amount,
      frequency,
      category: input.category.trim(),
      ...serializeSchedule(schedule),
    });

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async updateIncome(
    userId: string,
    incomeId: string,
    input: EditIncomeInput,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const normalized = normalizeRecurringFinanceData(current);
    const existing = normalized.income.find((source) => source.id === incomeId);

    if (!existing) {
      throw new Error("Income source not found.");
    }

    const updated = buildUpdatedIncomeSource(existing, input);
    const { error } = await this.supabase
      .from("transactions")
      .update(buildIncomeUpdate(updated))
      .eq("id", incomeId)
      .eq("user_id", userId)
      .eq("transaction_type", "income");

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async deleteIncome(userId: string, incomeId: string): Promise<FinanceData> {
    const { error } = await this.supabase
      .from("transactions")
      .delete()
      .eq("id", incomeId)
      .eq("user_id", userId)
      .eq("transaction_type", "income")
      .not("frequency", "is", null);

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async setIncomePaused(
    userId: string,
    incomeId: string,
    paused: boolean,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const normalized = normalizeRecurringFinanceData(current);
    const existing = normalized.income.find((source) => source.id === incomeId);

    if (!existing?.schedule) {
      throw new Error("Income source not found.");
    }

    const updated = {
      ...existing,
      schedule: {
        ...existing.schedule,
        status: paused ? ("paused" as const) : ("active" as const),
      },
    };

    const { error } = await this.supabase
      .from("transactions")
      .update(buildIncomeUpdate(updated))
      .eq("id", incomeId)
      .eq("user_id", userId)
      .eq("transaction_type", "income");

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async markIncomeReceived(
    userId: string,
    incomeId: string,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const normalized = normalizeRecurringFinanceData(current);
    const next = applyActivityToData(normalized, `income:${incomeId}`);

    return this.saveRecurringState(userId, next);
  }

  async createDebt(
    userId: string,
    input: AddDebtInput,
    id?: string,
  ): Promise<FinanceData> {
    const debtId = id ?? crypto.randomUUID();
    const debt = {
      id: debtId,
      name: input.name.trim(),
      balance: input.balance,
      originalBalance: input.balance,
      interestRate: input.interestRate,
      minimumPayment: input.minimumPayment,
      monthlyChange: -input.minimumPayment,
      dueDay: input.dueDay,
      accountType: input.accountType,
    };

    const { error } = await this.supabase
      .from("accounts")
      .insert(buildDebtInsert(userId, debt));

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async updateDebt(
    userId: string,
    debtId: string,
    input: EditDebtInput,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const existing = current.debts.find((debt) => debt.id === debtId);

    if (!existing) {
      throw new Error("Debt not found.");
    }

    const updated = buildUpdatedDebt(existing, input);
    const { error } = await this.supabase
      .from("accounts")
      .update(buildDebtUpdate(updated))
      .eq("id", debtId)
      .eq("user_id", userId)
      .eq("record_kind", "debt");

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async deleteDebt(userId: string, debtId: string): Promise<FinanceData> {
    const { error } = await this.supabase
      .from("accounts")
      .delete()
      .eq("id", debtId)
      .eq("user_id", userId)
      .eq("record_kind", "debt");

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async makeDebtPayment(
    userId: string,
    debtId: string,
    amount: number,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const debt = current.debts.find((item) => item.id === debtId);
    const cashAccount = getPrimaryCashAccount(current);

    if (!debt) {
      throw new Error("Debt not found.");
    }

    const paymentAmount = Math.min(Math.max(amount, 0), debt.balance);
    const nextBalance = Math.max(debt.balance - paymentAmount, 0);
    const timestamp = new Date().toISOString();

    const { error: debtError } = await this.supabase
      .from("accounts")
      .update({
        balance: nextBalance,
        monthly_change: -paymentAmount,
        updated_at: timestamp,
      })
      .eq("id", debtId)
      .eq("user_id", userId)
      .eq("record_kind", "debt");

    if (debtError) throw debtError;

    if (cashAccount && paymentAmount > 0) {
      const { error: accountError } = await this.supabase
        .from("accounts")
        .update({
          balance: cashAccount.balance - paymentAmount,
          updated_at: timestamp,
        })
        .eq("id", cashAccount.id)
        .eq("user_id", userId);

      if (accountError) throw accountError;
    }

    return this.loadFinanceData(userId);
  }

  async createBill(userId: string, input: AddBillInput, id?: string): Promise<FinanceData> {
    const { error } = await this.supabase.from("bills").insert({
      ...(id ? { id } : {}),
      user_id: userId,
      name: input.name.trim(),
      amount: input.amount,
      due_day: input.dueDay,
      autopay: input.autopay,
      recurring: input.recurring,
      category: normalizeBillCategory(input.category),
      paid_month: null,
    });

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async updateBill(
    userId: string,
    billId: string,
    input: EditBillInput,
  ): Promise<FinanceData> {
    const { error } = await this.supabase
      .from("bills")
      .update({
        name: input.name.trim(),
        amount: input.amount,
        due_day: input.dueDay,
        autopay: input.autopay,
        recurring: input.recurring,
        category: normalizeBillCategory(input.category),
        updated_at: new Date().toISOString(),
      })
      .eq("id", billId)
      .eq("user_id", userId);

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async deleteBill(userId: string, billId: string): Promise<FinanceData> {
    const { error } = await this.supabase
      .from("bills")
      .delete()
      .eq("id", billId)
      .eq("user_id", userId);

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async markBillPaid(userId: string, billId: string): Promise<FinanceData> {
    const { data: bill, error: billError } = await this.supabase
      .from("bills")
      .select("amount")
      .eq("id", billId)
      .eq("user_id", userId)
      .single();

    if (billError) throw billError;

    const current = await this.loadFinanceData(userId);
    const cashAccount = getPrimaryCashAccount(current);

    if (cashAccount) {
      const { error: accountError } = await this.supabase
        .from("accounts")
        .update({
          balance: cashAccount.balance - Number(bill.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cashAccount.id)
        .eq("user_id", userId);

      if (accountError) throw accountError;
    }

    const { error } = await this.supabase
      .from("bills")
      .update({
        paid_month: getCurrentYearMonth(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", billId)
      .eq("user_id", userId);

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async createGoal(
    userId: string,
    input: CreateGoalInput,
    id?: string,
  ): Promise<FinanceData> {
    const meta = getGoalTypeMeta(input.type);

    const { error } = await this.supabase.from("goals").insert({
      ...(id ? { id } : {}),
      user_id: userId,
      name: input.name.trim(),
      goal_type: input.type,
      icon: meta.icon,
      current_amount: input.current,
      target_amount: input.target,
    });

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async updateGoal(
    userId: string,
    goalId: string,
    input: EditGoalInput,
  ): Promise<FinanceData> {
    const meta = getGoalTypeMeta(input.type);

    const { error } = await this.supabase
      .from("goals")
      .update({
        name: input.name.trim(),
        goal_type: input.type,
        icon: meta.icon,
        target_amount: input.target,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("user_id", userId);

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async addMoneyToGoal(
    userId: string,
    input: AddMoneyToGoalInput,
  ): Promise<FinanceData> {
    const { data: goal, error: goalError } = await this.supabase
      .from("goals")
      .select("current_amount, target_amount")
      .eq("id", input.goalId)
      .eq("user_id", userId)
      .single();

    if (goalError) throw goalError;

    const nextAmount = Math.min(
      Number(goal.current_amount) + input.amount,
      Number(goal.target_amount),
    );

    const { error: updateError } = await this.supabase
      .from("goals")
      .update({
        current_amount: nextAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.goalId)
      .eq("user_id", userId);

    if (updateError) throw updateError;

    const current = await this.loadFinanceData(userId);
    const cashAccount = getPrimaryCashAccount(current);

    if (cashAccount) {
      const { error: accountError } = await this.supabase
        .from("accounts")
        .update({
          balance: cashAccount.balance - input.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cashAccount.id)
        .eq("user_id", userId);

      if (accountError) throw accountError;
    }

    const { error: transactionError } = await this.supabase
      .from("transactions")
      .insert({
        user_id: userId,
        transaction_type: "goal_contribution",
        name: "Goal contribution",
        amount: input.amount,
        category: "Savings",
        goal_id: input.goalId,
      });

    if (transactionError) throw transactionError;
    return this.loadFinanceData(userId);
  }

  async saveRecurringState(
    userId: string,
    data: FinanceData,
  ): Promise<FinanceData> {
    const timestamp = new Date().toISOString();

    const accountUpdates = data.accounts.map((account) =>
      this.supabase
        .from("accounts")
        .update({
          balance: account.balance,
          updated_at: timestamp,
        })
        .eq("id", account.id)
        .eq("user_id", userId),
    );

    const investmentUpdates = data.investments.map((investment) =>
      this.supabase
        .from("investments")
        .update(buildInvestmentUpdate(investment))
        .eq("id", investment.id)
        .eq("user_id", userId),
    );

    const billUpdates = data.bills.map((bill) =>
      this.supabase
        .from("bills")
        .update(buildBillUpdate(bill))
        .eq("id", bill.id)
        .eq("user_id", userId),
    );

    const goalUpdates = data.savingsGoals.map((goal) =>
      this.supabase
        .from("goals")
        .update(buildGoalUpdate(goal))
        .eq("id", goal.id)
        .eq("user_id", userId),
    );

    const incomeUpdates = data.income.map((income) =>
      this.supabase
        .from("transactions")
        .update(buildIncomeUpdate(income))
        .eq("id", income.id)
        .eq("user_id", userId),
    );

    const results = await Promise.all([
      ...accountUpdates,
      ...investmentUpdates,
      ...billUpdates,
      ...goalUpdates,
      ...incomeUpdates,
    ]);

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }

    await this.recurringItems.syncFromFinanceData(userId, data);

    return this.loadFinanceData(userId);
  }

  async createTransaction(
    userId: string,
    data: FinanceData,
    transaction: Transaction,
  ): Promise<FinanceData> {
    const { error: insertError } = await this.supabase
      .from("transactions")
      .insert(buildTransactionInsert(userId, transaction));

    if (insertError) throw insertError;

    return this.persistAccountBalances(userId, data);
  }

  async updateTransaction(
    userId: string,
    transactionId: string,
    data: FinanceData,
    transaction: Transaction,
  ): Promise<FinanceData> {
    const { error } = await this.supabase
      .from("transactions")
      .update(buildTransactionUpdate(transaction))
      .eq("id", transactionId)
      .eq("user_id", userId);

    if (error) throw error;

    return this.persistAccountBalances(userId, data);
  }

  async deleteTransaction(
    userId: string,
    transactionId: string,
    data: FinanceData,
  ): Promise<FinanceData> {
    const { error } = await this.supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", userId);

    if (error) throw error;

    return this.persistAccountBalances(userId, data);
  }

  private async persistAccountBalances(
    userId: string,
    data: FinanceData,
  ): Promise<FinanceData> {
    const timestamp = new Date().toISOString();

    const accountUpdates = data.accounts.map((account) =>
      this.supabase
        .from("accounts")
        .update({
          balance: account.balance,
          updated_at: timestamp,
        })
        .eq("id", account.id)
        .eq("user_id", userId),
    );

    const goalUpdates = data.savingsGoals.map((goal) =>
      this.supabase
        .from("goals")
        .update(buildGoalUpdate(goal))
        .eq("id", goal.id)
        .eq("user_id", userId),
    );

    const results = await Promise.all([...accountUpdates, ...goalUpdates]);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }

    return this.loadFinanceData(userId);
  }
}

export { emptyFinanceData, getErrorMessage };

/** Backward-compatible alias for existing imports. */
export { FinanceService as FinanceRepository };
