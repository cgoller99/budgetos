import type { FinanceEvent } from "@/lib/events/types";
import { normalizeBillCategory } from "@/lib/finance/billCategories";
import { buildUpdatedBill, getCurrentYearMonth } from "@/lib/finance/bills";
import {
  applyBillPaymentToData,
  applyDebtPaymentToData,
  applyGoalContributionToData,
} from "@/lib/finance/balanceEffects";
import { isUserInDemoMode } from "@/lib/finance/demoData";
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
import { normalizeBillFrequency, normalizeIncomeFrequency } from "@/lib/recurring/frequencies";
import {
  normalizeRecurringFinanceData,
  serializeSchedule,
} from "@/lib/recurring/normalize";
import { createSchedule, parseDateString } from "@/lib/recurring/schedule";
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
import { getErrorMessage } from "@/lib/supabase/errors";
import {
  householdFinanceOrFilter,
  resolveUserHouseholdId,
} from "@/lib/supabase/householdFinance";
import type { OnboardingState } from "@/lib/onboarding/types";

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

  async getHouseholdId(userId: string): Promise<string | null> {
    return resolveUserHouseholdId(this.supabase, userId);
  }

  private withHouseholdId<T extends Record<string, unknown>>(
    row: T,
    householdId: string | null,
  ): T {
    if (!householdId) {
      return row;
    }

    return { ...row, household_id: householdId };
  }

  private applyOwnedOrHouseholdFilter<
    T extends {
      eq: (column: string, value: string) => T;
      or: (filters: string) => T;
    },
  >(query: T, userId: string, householdId: string | null): T {
    const filter = householdFinanceOrFilter(userId, householdId);

    if (filter) {
      return query.or(filter);
    }

    return query.eq("user_id", userId);
  }

  private async insertTransaction(
    userId: string,
    transaction: Transaction,
  ): Promise<void> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const { error } = await this.supabase
      .from("transactions")
      .insert(
        this.withHouseholdId(
          buildTransactionInsert(userId, transaction),
          householdId,
        ),
      );

    if (error) {
      throw error;
    }
  }

  async loadFinanceData(userId: string): Promise<FinanceData> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const scopeFilter = householdFinanceOrFilter(userId, householdId);

    const scopedSelect = (table: string) => {
      let query = this.supabase.from(table).select("*");

      if (scopeFilter) {
        query = query.or(scopeFilter);
      } else {
        query = query.eq("user_id", userId);
      }

      return query;
    };

    const [
      accountsResult,
      billsResult,
      goalsResult,
      transactionsResult,
      investmentsResult,
      events,
    ] = await Promise.all([
      scopedSelect("accounts"),
      scopedSelect("bills"),
      scopedSelect("goals"),
      scopedSelect("transactions"),
      scopedSelect("investments"),
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

  async exitDemoMode(userId: string): Promise<{
    data: FinanceData;
    onboarding: OnboardingState;
  }> {
    const freshState = {
      complete: true,
      mode: "fresh" as const,
      demoProfileId: null,
    };

    await this.profiles.saveOnboardingState(userId, freshState);
    await this.replaceFinanceData(userId, emptyFinanceData);
    const [verifiedData, verifiedOnboarding] = await Promise.all([
      this.loadFinanceData(userId),
      this.profiles.loadOnboardingState(userId),
    ]);

    if (isUserInDemoMode(verifiedOnboarding.mode, verifiedData)) {
      throw new Error(
        "Demo mode is still active after exit. Reload the page and try again.",
      );
    }

    return {
      data: verifiedData,
      onboarding: verifiedOnboarding,
    };
  }

  async replaceFinanceData(userId: string, data: FinanceData): Promise<FinanceData> {
    const deleteResults = await Promise.all([
      this.supabase.from("accounts").delete().eq("user_id", userId),
      this.supabase.from("bills").delete().eq("user_id", userId),
      this.supabase.from("goals").delete().eq("user_id", userId),
      this.supabase.from("transactions").delete().eq("user_id", userId),
      this.supabase.from("notifications").delete().eq("user_id", userId),
      this.supabase.from("recurring_items").delete().eq("user_id", userId),
    ]);

    const deleteError = deleteResults.find((result) => result.error)?.error;

    if (deleteError) {
      throw deleteError;
    }

    const investmentsDelete = await this.supabase
      .from("investments")
      .delete()
      .eq("user_id", userId);

    if (
      investmentsDelete.error &&
      !investmentsDelete.error.message.includes("investments")
    ) {
      throw investmentsDelete.error;
    }

    await seedFinanceData(this.supabase, userId, data);
    return this.loadFinanceData(userId);
  }

  async createAccount(
    userId: string,
    input: AddAccountInput,
    id?: string,
  ): Promise<FinanceData> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const { error } = await this.supabase.from("accounts").insert(
      this.withHouseholdId(
        {
          ...(id ? { id } : {}),
          user_id: userId,
          record_kind: "account" as const,
          name: input.name.trim(),
          institution: input.institution.trim(),
          type: input.type,
          balance: input.balance,
          monthly_change: 0,
          interest_rate: null,
          minimum_payment: null,
          monthly_contribution: null,
        },
        householdId,
      ),
    );

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async createIncome(
    userId: string,
    input: AddIncomeInput,
    id?: string,
  ): Promise<FinanceData> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const frequency = normalizeIncomeFrequency(input.frequency);
    const referenceDate = new Date();
    const startDate = input.startDate
      ? parseDateString(input.startDate)
      : (() => {
          const fallback = new Date(referenceDate);
          fallback.setDate(fallback.getDate() - 120);
          return fallback;
        })();
    const schedule = createSchedule(startDate, frequency, referenceDate);

    const { error } = await this.supabase.from("transactions").insert(
      this.withHouseholdId(
        {
          ...(id ? { id } : {}),
          user_id: userId,
          transaction_type: "income" as const,
          name: input.name.trim(),
          amount: input.amount,
          frequency,
          category: input.category.trim(),
          account_id: input.depositAccountId ?? null,
          ...serializeSchedule(schedule),
        },
        householdId,
      ),
    );

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
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
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
      .insert(
        this.withHouseholdId(buildDebtInsert(userId, debt), householdId),
      );

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

    if (!debt) {
      throw new Error("Debt not found.");
    }

    const paymentAmount = Math.min(Math.max(amount, 0), debt.balance);
    const next = applyDebtPaymentToData(current, debtId, paymentAmount);
    const updatedDebt = next.debts.find((item) => item.id === debtId);
    const newTransaction = next.transactions.find(
      (transaction) =>
        transaction.debtId === debtId &&
        !current.transactions.some((item) => item.id === transaction.id),
    );
    const timestamp = new Date().toISOString();

    if (updatedDebt) {
      const { error: debtError } = await this.supabase
        .from("accounts")
        .update({
          balance: updatedDebt.balance,
          monthly_change: updatedDebt.monthlyChange,
          updated_at: timestamp,
        })
        .eq("id", debtId)
        .eq("user_id", userId)
        .eq("record_kind", "debt");

      if (debtError) throw debtError;
    }

    if (newTransaction) {
      await this.insertTransaction(userId, newTransaction);
    }

    return this.persistAccountBalances(userId, next);
  }

  async createBill(userId: string, input: AddBillInput, id?: string): Promise<FinanceData> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const frequency = normalizeBillFrequency(input.frequency ?? "monthly");
    const referenceDate = new Date();
    const startDate = input.startDate
      ? parseDateString(input.startDate)
      : new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          Math.min(input.dueDay > 0 ? input.dueDay : referenceDate.getDate(), 28),
        );
    const schedule = createSchedule(
      startDate,
      frequency,
      referenceDate,
      input.recurring ? "active" : "paused",
    );

    const { error } = await this.supabase.from("bills").insert(
      this.withHouseholdId(
        {
          ...(id ? { id } : {}),
          user_id: userId,
          name: input.name.trim(),
          amount: input.amount,
          due_day: input.dueDay,
          autopay: input.autopay,
          recurring: input.recurring,
          category: normalizeBillCategory(input.category),
          paid_month: null,
          bill_frequency: frequency,
          paycheck_assignment: input.paycheckAssignment ?? "first_paycheck",
          custom_pay_day: input.customPayDay ?? null,
          payment_account_id: input.paymentAccountId ?? null,
          ...serializeSchedule(schedule),
        },
        householdId,
      ),
    );

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async updateBill(
    userId: string,
    billId: string,
    input: EditBillInput,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const normalized = normalizeRecurringFinanceData(current);
    const existing = normalized.bills.find((bill) => bill.id === billId);

    if (!existing) {
      throw new Error("Bill not found.");
    }

    const updated = buildUpdatedBill(existing, input);
    const { error } = await this.supabase
      .from("bills")
      .update(buildBillUpdate(updated))
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
    const current = await this.loadFinanceData(userId);
    const bill = current.bills.find((item) => item.id === billId);

    if (!bill) {
      throw new Error("Bill not found.");
    }

    const next = applyBillPaymentToData(current, bill);
    const newTransaction = next.transactions.find(
      (transaction) =>
        transaction.billId === billId &&
        !current.transactions.some((item) => item.id === transaction.id),
    );

    const { error: billError } = await this.supabase
      .from("bills")
      .update({
        paid_month: getCurrentYearMonth(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", billId)
      .eq("user_id", userId);

    if (billError) throw billError;

    if (newTransaction) {
      await this.insertTransaction(userId, newTransaction);
    }

    return this.persistAccountBalances(userId, next);
  }

  async createGoal(
    userId: string,
    input: CreateGoalInput,
    id?: string,
  ): Promise<FinanceData> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const meta = getGoalTypeMeta(input.type);

    const { error } = await this.supabase.from("goals").insert(
      this.withHouseholdId(
        {
          ...(id ? { id } : {}),
          user_id: userId,
          name: input.name.trim(),
          goal_type: input.type,
          icon: meta.icon,
          current_amount: input.current,
          target_amount: input.target,
        },
        householdId,
      ),
    );

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
    const current = await this.loadFinanceData(userId);
    const next = applyGoalContributionToData(
      current,
      input.goalId,
      input.amount,
    );
    const updatedGoal = next.savingsGoals.find((item) => item.id === input.goalId);
    const newTransaction = next.transactions.find(
      (transaction) =>
        transaction.goalId === input.goalId &&
        !current.transactions.some((item) => item.id === transaction.id),
    );

    if (updatedGoal) {
      const { error: updateError } = await this.supabase
        .from("goals")
        .update({
          current_amount: updatedGoal.current,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.goalId)
        .eq("user_id", userId);

      if (updateError) throw updateError;
    }

    if (newTransaction) {
      await this.insertTransaction(userId, newTransaction);
    }

    return this.persistAccountBalances(userId, next);
  }

  async saveRecurringState(
    userId: string,
    data: FinanceData,
  ): Promise<FinanceData> {
    const timestamp = new Date().toISOString();
    const current = await this.loadFinanceData(userId);
    const existingTransactionIds = new Set(
      current.transactions.map((transaction) => transaction.id),
    );
    const newTransactions = data.transactions.filter(
      (transaction) => !existingTransactionIds.has(transaction.id),
    );

    for (const transaction of newTransactions) {
      await this.insertTransaction(userId, transaction);
    }

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
    await this.insertTransaction(userId, transaction);

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
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const timestamp = new Date().toISOString();

    const accountUpdates = data.accounts.map((account) => {
      let query = this.supabase
        .from("accounts")
        .update({
          balance: account.balance,
          updated_at: timestamp,
        })
        .eq("id", account.id);

      if (!householdId) {
        query = query.eq("user_id", userId);
      }

      return query;
    });

    const goalUpdates = data.savingsGoals.map((goal) => {
      let query = this.supabase
        .from("goals")
        .update(buildGoalUpdate(goal))
        .eq("id", goal.id);

      if (!householdId) {
        query = query.eq("user_id", userId);
      }

      return query;
    });

    const results = await Promise.all([...accountUpdates, ...goalUpdates]);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }

    return this.loadFinanceData(userId);
  }
}

export { emptyFinanceData };

/** Backward-compatible alias for existing imports. */
export { FinanceService as FinanceRepository };
