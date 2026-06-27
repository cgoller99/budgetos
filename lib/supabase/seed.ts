import type { FinanceData, SavingsGoal } from "@/lib/finance/types";
import type { AutoContribution } from "@/lib/recurring/types";
import type { BudgetOsSupabaseClient } from "@/lib/supabase/client";
import {
  normalizeRecurringFinanceData,
  serializeSchedule,
} from "@/lib/recurring";
import { createSchedule } from "@/lib/recurring/schedule";

function defaultStartDate(referenceDate: Date, daysAgo = 60): Date {
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - daysAgo);
  return start;
}

function createDemoGoalContribution(
  goal: SavingsGoal,
  referenceDate: Date,
): AutoContribution {
  const isHouse =
    goal.type === "house" || goal.name.toLowerCase().includes("house");
  const amount = isHouse ? 200 : goal.type === "emergency_fund" ? 150 : 75;
  const frequency = isHouse ? "weekly" : "monthly";
  const startDate = defaultStartDate(referenceDate);

  return {
    amount,
    frequency,
    schedule: createSchedule(startDate, frequency, referenceDate),
  };
}

function withDemoGoalContributions(
  data: FinanceData,
  referenceDate = new Date(),
): FinanceData {
  return {
    ...data,
    savingsGoals: data.savingsGoals.map((goal) => ({
      ...goal,
      autoContribution:
        goal.autoContribution ?? createDemoGoalContribution(goal, referenceDate),
    })),
  };
}

export async function seedFinanceData(
  supabase: BudgetOsSupabaseClient,
  userId: string,
  seedData: FinanceData,
): Promise<void> {
  const normalized = withDemoGoalContributions(
    normalizeRecurringFinanceData(seedData),
  );

  const accountRows = [
    ...normalized.accounts.map((account) => ({
      user_id: userId,
      record_kind: "account" as const,
      name: account.name,
      institution: account.institution,
      type: account.type,
      balance: account.balance,
      monthly_change: account.monthlyChange,
      interest_rate: null,
      minimum_payment: null,
      monthly_contribution: null,
      contribution_frequency: null,
      start_date: null,
      next_occurrence: null,
      last_processed_date: null,
      recurring_status: null,
    })),
    ...normalized.debts.map((debt) => ({
      user_id: userId,
      record_kind: "debt" as const,
      name: debt.name,
      institution: "",
      type: debt.accountType,
      balance: debt.balance,
      original_balance: debt.originalBalance,
      monthly_change: debt.monthlyChange,
      interest_rate: debt.interestRate,
      minimum_payment: debt.minimumPayment,
      due_day: debt.dueDay,
      monthly_contribution: null,
      contribution_frequency: null,
      start_date: null,
      next_occurrence: null,
      last_processed_date: null,
      recurring_status: null,
    })),
  ];

  if (accountRows.length > 0) {
    const { error: accountsError } = await supabase
      .from("accounts")
      .insert(accountRows);

    if (accountsError) {
      throw accountsError;
    }
  }

  const investmentRows = normalized.investments.map((investment) => ({
    user_id: userId,
    name: investment.name,
    type: investment.type,
    value: investment.value,
    monthly_change: investment.monthlyChange,
    monthly_contribution:
      investment.autoContribution?.amount ?? investment.monthlyContribution,
    contribution_frequency: investment.autoContribution?.frequency ?? null,
    ...(investment.autoContribution
      ? serializeSchedule(investment.autoContribution.schedule)
      : {
          start_date: null,
          next_occurrence: null,
          last_processed_date: null,
          recurring_status: null,
        }),
  }));

  if (investmentRows.length > 0) {
    const { error: investmentsError } = await supabase
      .from("investments")
      .insert(investmentRows);

    if (investmentsError && !investmentsError.message.includes("investments")) {
      throw investmentsError;
    }
  }

  if (normalized.bills.length > 0) {
    const { error: billsError } = await supabase.from("bills").insert(
      normalized.bills.map((bill) => ({
        user_id: userId,
        name: bill.name,
        amount: bill.amount,
        due_day: bill.dueDay,
        autopay: bill.autopay,
        recurring: bill.recurring,
        category: bill.category,
        paid_month: bill.paidMonth,
        bill_frequency: bill.frequency ?? bill.schedule?.frequency ?? "monthly",
        ...(bill.schedule ? serializeSchedule(bill.schedule) : {}),
      })),
    );

    if (billsError) {
      throw billsError;
    }
  }

  if (normalized.savingsGoals.length > 0) {
    const { error: goalsError } = await supabase.from("goals").insert(
      normalized.savingsGoals.map((goal) => ({
        user_id: userId,
        name: goal.name,
        goal_type: goal.type,
        icon: goal.icon,
        current_amount: goal.current,
        target_amount: goal.target,
        created_at: goal.createdAt,
        contribution_amount: goal.autoContribution?.amount ?? null,
        contribution_frequency: goal.autoContribution?.frequency ?? null,
        ...(goal.autoContribution
          ? serializeSchedule(goal.autoContribution.schedule)
          : {}),
      })),
    );

    if (goalsError) {
      throw goalsError;
    }
  }

  if (normalized.income.length > 0) {
    const { error: transactionsError } = await supabase.from("transactions").insert(
      normalized.income.map((income) => ({
        user_id: userId,
        transaction_type: "income" as const,
        name: income.name,
        amount: income.amount,
        frequency: income.frequency,
        category: income.category,
        ...(income.schedule ? serializeSchedule(income.schedule) : {}),
      })),
    );

    if (transactionsError) {
      throw transactionsError;
    }
  }
}

/** @deprecated Use seedFinanceData with explicit data instead. */
export async function seedFinanceDataIfEmpty(
  supabase: BudgetOsSupabaseClient,
  userId: string,
  seedData?: FinanceData,
): Promise<void> {
  if (!seedData) {
    return;
  }

  await seedFinanceData(supabase, userId, seedData);
}
