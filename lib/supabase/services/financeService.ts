import type { FinanceEvent } from "@/lib/events/types";
import { normalizeBillCategory } from "@/lib/finance/billCategories";
import {
  applyBillSplitPaymentByIdToData,
  applyDebtPaymentToData,
  applyGoalContributionToData,
} from "@/lib/finance/balanceEffects";
import {
  billAmountFromSplits,
  normalizeBillSplitInputs,
} from "@/lib/finance/billSplits";
import { buildUpdatedBill, findBillSplit, getCurrentYearMonth } from "@/lib/finance/bills";
import { isUserInDemoMode } from "@/lib/finance/demoData";
import { emptyFinanceData } from "@/lib/finance/emptyFinanceData";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";
import { buildUpdatedIncomeSource } from "@/lib/finance/income";
import {
  applyPlaidAccountEditRestrictions,
  buildUpdatedAccount,
} from "@/lib/finance/accounts";
import { buildUpdatedDebt } from "@/lib/finance/debts";
import type {
  AddAccountInput,
  AddBillInput,
  AddDebtInput,
  AddIncomeInput,
  AddMoneyToGoalInput,
  CreateGoalInput,
  EditBillInput,
  EditAccountInput,
  EditDebtInput,
  DeleteAccountOptions,
  EditGoalInput,
  EditIncomeInput,
  FinanceData,
  Transaction,
} from "@/lib/finance/types";
import type { MarkPaycheckReceivedInput, SaveIncomePlanInput } from "@/lib/incomePlan/types";
import { applyIncomePlanPaycheckToData } from "@/lib/incomePlan/applyPaycheck";
import {
  getPaycheckIndexInMonth,
  isExtraPaycheckMonth,
} from "@/lib/incomePlan/payDates";
import { applyActivityToData } from "@/lib/recurring/applyActivity";
import { normalizeBillFrequency, normalizeIncomeFrequency } from "@/lib/recurring/frequencies";
import {
  normalizeRecurringFinanceData,
  serializeSchedule,
} from "@/lib/recurring/normalize";
import { createSchedule, parseDateString } from "@/lib/recurring/schedule";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  buildBillSplitInsert,
  buildBillSplitUpdate,
  buildBillUpdate,
  buildDebtInsert,
  buildDebtUpdate,
  buildGoalUpdate,
  buildIncomeUpdate,
  buildInvestmentUpdate,
  buildManualAccountUpdate,
  buildTransactionInsert,
  buildTransactionUpdate,
  mapFinanceData,
} from "@/lib/supabase/mappers";
import { NotificationsRepository } from "@/lib/supabase/repositories/notificationsRepository";
import { AllocationRepository } from "@/lib/supabase/repositories/allocationRepository";
import { IncomePlanRepository } from "@/lib/supabase/repositories/incomePlanRepository";
import { ProfilesRepository } from "@/lib/supabase/repositories/profilesRepository";
import { RecurringItemsRepository } from "@/lib/supabase/repositories/recurringItemsRepository";
import {
  BankConnectionsRepository,
  mapBankConnectionRow,
} from "@/lib/supabase/repositories/bankConnectionsRepository";
import { seedFinanceData } from "@/lib/supabase/seed";
import { getErrorMessage } from "@/lib/supabase/errors";
import {
  householdFinanceOrFilter,
  resolveUserHouseholdId,
} from "@/lib/supabase/householdFinance";
import type { OnboardingState } from "@/lib/onboarding/types";
import {
  ACCOUNT_SELECT_COLUMNS,
  BILL_SELECT_COLUMNS,
  BILL_SPLIT_SELECT_COLUMNS,
  GOAL_SELECT_COLUMNS,
  INVESTMENT_SELECT_COLUMNS,
  TRANSACTION_SELECT_COLUMNS,
} from "@/lib/finance/queryColumns";
import {
  FINANCE_TRANSACTION_BOOTSTRAP_LIMIT,
  FINANCE_TRANSACTION_LOOKBACK_DAYS,
  FINANCE_TRANSACTION_PAGE_SIZE,
  buildTransactionsLoadMeta,
  getTransactionLookbackStartIso,
} from "@/lib/finance/transactionWindow";
import type {
  AccountRow,
  BillRow,
  BillSplitRow,
  GoalRow,
  InvestmentRow,
  TransactionRow,
} from "@/lib/supabase/database.types";

export class FinanceService {
  private readonly notifications: NotificationsRepository;
  private readonly incomePlans: IncomePlanRepository;
  private readonly allocations: AllocationRepository;
  private readonly profiles: ProfilesRepository;
  private readonly recurringItems: RecurringItemsRepository;
  private readonly bankConnections: BankConnectionsRepository;

  constructor(private readonly supabase: BuxmeSupabaseClient) {
    this.notifications = new NotificationsRepository(supabase);
    this.incomePlans = new IncomePlanRepository(supabase);
    this.allocations = new AllocationRepository(supabase);
    this.profiles = new ProfilesRepository(supabase);
    this.recurringItems = new RecurringItemsRepository(supabase);
    this.bankConnections = new BankConnectionsRepository(supabase);
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
    const lookbackStart = getTransactionLookbackStartIso();

    const scopedSelect = (table: string, columns: string) => {
      let query = this.supabase.from(table).select(columns);

      if (scopeFilter) {
        query = query.or(scopeFilter);
      } else {
        query = query.eq("user_id", userId);
      }

      return query;
    };

    const scopedTransactions = () => {
      let query = this.supabase
        .from("transactions")
        .select(TRANSACTION_SELECT_COLUMNS)
        .gte("transaction_date", lookbackStart)
        .order("transaction_date", { ascending: false })
        .limit(FINANCE_TRANSACTION_BOOTSTRAP_LIMIT);

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
      billSplitsResult,
      goalsResult,
      transactionsResult,
      investmentsResult,
      events,
    ] = await Promise.all([
      scopedSelect("accounts", ACCOUNT_SELECT_COLUMNS),
      scopedSelect("bills", BILL_SELECT_COLUMNS),
      scopedSelect("bill_splits", BILL_SPLIT_SELECT_COLUMNS),
      scopedSelect("goals", GOAL_SELECT_COLUMNS),
      scopedTransactions(),
      scopedSelect("investments", INVESTMENT_SELECT_COLUMNS),
      this.notifications.loadEvents(userId),
    ]);

    if (accountsResult.error) throw accountsResult.error;
    if (billsResult.error) throw billsResult.error;
    if (goalsResult.error) throw goalsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;

    let billSplitRows = billSplitsResult.data ?? [];

    if (billSplitsResult.error) {
      if (!billSplitsResult.error.message.includes("bill_splits")) {
        throw billSplitsResult.error;
      }
      billSplitRows = [];
    }

    if (investmentsResult.error) {
      // Table may not exist until migration runs — fall back to legacy accounts rows.
      if (!investmentsResult.error.message.includes("investments")) {
        throw investmentsResult.error;
      }
    }

    const [incomePlanData, allocationData, connectionRows, recurringDismissals] =
      await Promise.all([
        this.incomePlans.loadIncomePlanData(userId),
        this.allocations.loadAllocationData(userId),
        this.bankConnections.listConnections(userId),
        this.bankConnections.listRecurringDismissals(userId),
      ]);

    const mapped = mapFinanceData(
      (accountsResult.data ?? []) as AccountRow[],
      (billsResult.data ?? []) as BillRow[],
      (goalsResult.data ?? []) as GoalRow[],
      (transactionsResult.data ?? []) as unknown as TransactionRow[],
      (investmentsResult.data ?? []) as InvestmentRow[],
      events,
      billSplitRows as BillSplitRow[],
    );

    const loadedCount = mapped.transactions.length;
    const oldestLoadedDate = mapped.transactions.at(-1)?.date?.slice(0, 10) ?? "";
    const truncated =
      loadedCount >= FINANCE_TRANSACTION_BOOTSTRAP_LIMIT ||
      (loadedCount > 0 && oldestLoadedDate <= lookbackStart.slice(0, 10));

    return {
      ...mapped,
      viewerUserId: userId,
      householdId,
      incomePlan: incomePlanData.incomePlan,
      incomePlanPaychecks: incomePlanData.incomePlanPaychecks,
      envelopeBalances: allocationData.envelopeBalances,
      allocationLedger: allocationData.allocationLedger,
      bankConnections: connectionRows.map(mapBankConnectionRow),
      plaidRecurringDismissals: recurringDismissals,
      transactionsMeta: buildTransactionsLoadMeta({
        transactions: mapped.transactions,
        truncated,
        lookbackDays: FINANCE_TRANSACTION_LOOKBACK_DAYS,
        limit: FINANCE_TRANSACTION_BOOTSTRAP_LIMIT,
      }),
    };
  }

  /**
   * Load an older page of transactions for the Transactions screen.
   * Does not replace the full finance graph.
   */
  async loadOlderTransactions(
    userId: string,
    options: { beforeDate: string; limit?: number } ,
  ): Promise<{ transactions: FinanceData["transactions"]; exhausted: boolean }> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const scopeFilter = householdFinanceOrFilter(userId, householdId);
    const limit = options.limit ?? FINANCE_TRANSACTION_PAGE_SIZE;

    let query = this.supabase
      .from("transactions")
      .select(TRANSACTION_SELECT_COLUMNS)
      .lt("transaction_date", options.beforeDate)
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (scopeFilter) {
      query = query.or(scopeFilter);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const mapped = mapFinanceData(
      [],
      [],
      [],
      (data ?? []) as unknown as TransactionRow[],
      [],
      [],
      [],
    );
    return {
      transactions: mapped.transactions,
      exhausted: (data?.length ?? 0) < limit,
    };
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

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await this.notifications.deleteNotification(userId, notificationId);
  }

  async clearAllNotifications(userId: string): Promise<void> {
    await this.notifications.clearAll(userId);
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

  async completeGuidedOnboarding(userId: string): Promise<OnboardingState> {
    const { createFreshOnboardingState } = await import("@/lib/onboarding/demoMode");
    return this.profiles.saveOnboardingState(userId, createFreshOnboardingState());
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
  ): Promise<FinanceData | null> {
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
    return null;
  }

  async updateAccount(
    userId: string,
    accountId: string,
    input: EditAccountInput,
  ): Promise<FinanceData | null> {
    const current = await this.loadFinanceData(userId);
    const existing = current.accounts.find((item) => item.id === accountId);

    if (!existing) {
      throw new Error("Account not found.");
    }

    const sanitizedInput = applyPlaidAccountEditRestrictions(existing, input);
    const updated = buildUpdatedAccount(existing, sanitizedInput);
    const { error } = await this.supabase
      .from("accounts")
      .update(buildManualAccountUpdate(updated))
      .eq("id", accountId)
      .eq("user_id", userId)
      .eq("record_kind", "account");

    if (
      error &&
      (error.code === "42703" ||
        error.message?.includes("column") ||
        error.message?.includes("nickname"))
    ) {
      const { error: fallbackError } = await this.supabase
        .from("accounts")
        .update({
          name: updated.name.trim(),
          institution: updated.institution.trim(),
          type: updated.type,
          balance: updated.balance,
          original_balance: updated.startingBalance ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId)
        .eq("user_id", userId)
        .eq("record_kind", "account");

      if (fallbackError) throw fallbackError;
      return null;
    }

    if (error) throw error;
    return null;
  }

  private async deleteTransactionsForAccounts(
    userId: string,
    accountIds: string[],
  ): Promise<void> {
    if (accountIds.length === 0) {
      return;
    }

    for (const accountId of accountIds) {
      const { error: primaryError } = await this.supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .eq("account_id", accountId);

      if (primaryError) {
        throw primaryError;
      }

      const { error: transferError } = await this.supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .eq("transfer_to_account_id", accountId);

      if (transferError) {
        throw transferError;
      }
    }
  }

  async deleteAccount(
    userId: string,
    accountId: string,
    options: DeleteAccountOptions = {},
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const account = current.accounts.find((item) => item.id === accountId);

    if (!account) {
      throw new Error("Account not found.");
    }

    if (account.isPlaidLinked) {
      throw new Error(
        "Use disconnect to remove Plaid-linked accounts.",
      );
    }

    if (options.deleteTransactions) {
      await this.deleteTransactionsForAccounts(userId, [accountId]);
    }

    const { error } = await this.supabase
      .from("accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", userId)
      .eq("record_kind", "account");

    if (error) throw error;
    return this.loadFinanceData(userId);
  }

  async createIncome(
    userId: string,
    input: AddIncomeInput,
    id?: string,
  ): Promise<FinanceData | null> {
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
    return null;
  }

  async updateIncome(
    userId: string,
    incomeId: string,
    input: EditIncomeInput,
  ): Promise<FinanceData | null> {
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
    return null;
  }

  async deleteIncome(userId: string, incomeId: string): Promise<FinanceData | null> {
    const { error } = await this.supabase
      .from("transactions")
      .delete()
      .eq("id", incomeId)
      .eq("user_id", userId)
      .eq("transaction_type", "income")
      .not("frequency", "is", null);

    if (error) throw error;
    return null;
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
  ): Promise<FinanceData | null> {
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
    return null;
  }

  async updateDebt(
    userId: string,
    debtId: string,
    input: EditDebtInput,
  ): Promise<FinanceData | null> {
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
    return null;
  }

  async deleteDebt(userId: string, debtId: string): Promise<FinanceData | null> {
    const { error } = await this.supabase
      .from("accounts")
      .delete()
      .eq("id", debtId)
      .eq("user_id", userId)
      .eq("record_kind", "debt");

    if (error) throw error;
    return null;
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

  private async replaceBillSplits(
    userId: string,
    billId: string,
    householdId: string | null,
    splits: AddBillInput["splits"] | undefined,
    fallback: AddBillInput,
  ): Promise<void> {
    const normalized = normalizeBillSplitInputs(splits, {
      amount: fallback.amount,
      dueDay: fallback.dueDay,
      paycheckAssignment: fallback.paycheckAssignment,
      customPayDay: fallback.customPayDay,
      paymentAccountId: fallback.paymentAccountId,
    });

    const { error: deleteError } = await this.supabase
      .from("bill_splits")
      .delete()
      .eq("bill_id", billId)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    if (normalized.length === 0) {
      return;
    }

    const { error: insertError } = await this.supabase.from("bill_splits").insert(
      normalized.map((split, index) =>
        buildBillSplitInsert(userId, billId, householdId, split, index),
      ),
    );

    if (insertError) throw insertError;
  }

  async createBill(userId: string, input: AddBillInput, id?: string): Promise<FinanceData | null> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const frequency = normalizeBillFrequency(input.frequency ?? "monthly");
    const referenceDate = new Date();
    const normalizedSplits = normalizeBillSplitInputs(input.splits, {
      amount: input.amount,
      dueDay: input.dueDay,
      paycheckAssignment: input.paycheckAssignment,
      customPayDay: input.customPayDay,
      paymentAccountId: input.paymentAccountId,
    });
    const primarySplit = normalizedSplits[0];
    const totalAmount = billAmountFromSplits(normalizedSplits);
    const startDate = input.startDate
      ? parseDateString(input.startDate)
      : new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          Math.min(
            primarySplit.dueDay > 0 ? primarySplit.dueDay : referenceDate.getDate(),
            28,
          ),
        );
    const schedule = createSchedule(
      startDate,
      frequency,
      referenceDate,
      input.recurring ? "active" : "paused",
    );
    const billId = id ?? crypto.randomUUID();

    const { error } = await this.supabase.from("bills").insert(
      this.withHouseholdId(
        {
          id: billId,
          user_id: userId,
          name: input.name.trim(),
          amount: totalAmount,
          due_day: primarySplit.dueDay,
          autopay: input.autopay,
          recurring: input.recurring,
          category: normalizeBillCategory(input.category),
          paid_month: null,
          bill_frequency: frequency,
          paycheck_assignment: primarySplit.paycheckAssignment ?? "first_paycheck",
          custom_pay_day: primarySplit.customPayDay ?? null,
          payment_account_id: primarySplit.paymentAccountId ?? null,
          ...serializeSchedule(schedule),
        },
        householdId,
      ),
    );

    if (error) throw error;

    await this.replaceBillSplits(
      userId,
      billId,
      householdId,
      normalizedSplits,
      { ...input, amount: totalAmount, dueDay: primarySplit.dueDay },
    );

    return null;
  }

  async updateBill(
    userId: string,
    billId: string,
    input: EditBillInput,
  ): Promise<FinanceData | null> {
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

    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    await this.replaceBillSplits(
      userId,
      billId,
      householdId,
      (updated.splits ?? []).map((split) => ({
        id: split.id,
        amount: split.amount,
        dueDay: split.dueDay,
        paycheckAssignment: split.paycheckAssignment,
        customPayDay: split.customPayDay,
        paymentAccountId: split.paymentAccountId,
        paidMonth: split.paidMonth,
        sortOrder: split.sortOrder,
      })),
      {
        ...input,
        amount: updated.amount,
        dueDay: updated.dueDay,
      },
    );

    return null;
  }

  async deleteBill(userId: string, billId: string): Promise<FinanceData | null> {
    const { error } = await this.supabase
      .from("bills")
      .delete()
      .eq("id", billId)
      .eq("user_id", userId);

    if (error) throw error;
    return null;
  }

  async markBillSplitPaid(
    userId: string,
    billId: string,
    splitId: string,
    paymentAmount?: number,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const match = findBillSplit(current, billId, splitId);

    if (!match) {
      throw new Error("Bill split not found.");
    }

    const next = applyBillSplitPaymentByIdToData(
      current,
      billId,
      splitId,
      paymentAmount,
    );
    const updatedBill = next.bills.find((item) => item.id === billId);

    if (!updatedBill) {
      throw new Error("Bill not found.");
    }

    const split = (updatedBill.splits ?? []).find((item) => item.id === splitId);

    if ((updatedBill.splits ?? []).length > 0 && split) {
      const { error: splitError } = await this.supabase
        .from("bill_splits")
        .update(buildBillSplitUpdate(split))
        .eq("id", splitId)
        .eq("user_id", userId);

      if (splitError) throw splitError;
    }

    const { error: billError } = await this.supabase
      .from("bills")
      .update({
        paid_month: updatedBill.paidMonth,
        updated_at: new Date().toISOString(),
      })
      .eq("id", billId)
      .eq("user_id", userId);

    if (billError) throw billError;

    const newTransaction = next.transactions.find(
      (transaction) =>
        transaction.billId === billId &&
        !current.transactions.some((item) => item.id === transaction.id),
    );

    if (newTransaction) {
      await this.insertTransaction(userId, newTransaction);
    }

    return this.persistAccountBalances(userId, next);
  }

  async markBillPaid(userId: string, billId: string): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const bill = current.bills.find((item) => item.id === billId);

    if (!bill) {
      throw new Error("Bill not found.");
    }

    const split = bill.splits?.[0];
    const splitId = split?.id ?? `${billId}-legacy`;
    return this.markBillSplitPaid(userId, billId, splitId);
  }

  async createGoal(
    userId: string,
    input: CreateGoalInput,
    id?: string,
  ): Promise<FinanceData | null> {
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
    return null;
  }

  async updateGoal(
    userId: string,
    goalId: string,
    input: EditGoalInput,
  ): Promise<FinanceData | null> {
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
    return null;
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

  async saveIncomePlan(
    userId: string,
    input: SaveIncomePlanInput,
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    await this.incomePlans.saveIncomePlan(
      userId,
      input,
      current.incomePlan?.id ?? null,
    );
    return this.loadFinanceData(userId);
  }

  async markIncomePlanPaycheckReceived(
    userId: string,
    input: MarkPaycheckReceivedInput = {},
  ): Promise<FinanceData> {
    const current = await this.loadFinanceData(userId);
    const plan = current.incomePlan;

    if (!plan) {
      throw new Error("Set up your Income Plan first.");
    }

    const isExtra =
      input.isExtraPaycheck ??
      (isExtraPaycheckMonth(plan) &&
        getPaycheckIndexInMonth(plan, plan.nextPayDate) >= 3);

    const { data: next, paycheckEvent } = applyIncomePlanPaycheckToData(
      current,
      plan,
      { ...input, isExtraPaycheck: isExtra },
    );

    await this.saveRecurringState(userId, next);

    if (next.incomePlan) {
      await this.incomePlans.persistPaycheckReceived(
        userId,
        next.incomePlan,
        paycheckEvent,
      );

      const newLedgerIds = (next.allocationLedger ?? [])
        .filter((entry) => entry.paycheckEventId === paycheckEvent.id)
        .map((entry) => entry.id);

      await this.allocations.persistPaycheckAllocationState(
        userId,
        {
          envelopeBalances: next.envelopeBalances ?? [],
          allocationLedger: next.allocationLedger ?? [],
        },
        newLedgerIds,
      );
    }

    return this.loadFinanceData(userId);
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

    // Caller already holds the optimistic finance graph; avoid a full reload.
    return data;
  }
}

export { emptyFinanceData };

/** Backward-compatible alias for existing imports. */
export { FinanceService as FinanceRepository };
