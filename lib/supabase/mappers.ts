import type {
  AccountRow,
  BillRow,
  GoalRow,
  InvestmentRow,
  TransactionRow,
} from "@/lib/supabase/database.types";
import type { FinanceEvent } from "@/lib/events/types";
import type {
  Account,
  AccountType,
  Bill,
  BillFrequency,
  Debt,
  DebtAccountType,
  FinanceData,
  GoalType,
  IncomeFrequency,
  IncomeSource,
  Investment,
  SavingsGoal,
  Transaction,
  TransactionType as LedgerTransactionType,
} from "@/lib/finance/types";
import {
  deserializeSchedule,
  normalizeRecurringFinanceData,
  serializeSchedule,
} from "@/lib/recurring/normalize";
import { normalizeIncomeFrequency } from "@/lib/recurring/frequencies";
import { inferDebtAccountType } from "@/lib/finance/debts";
import type { AutoContribution } from "@/lib/recurring/types";

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function mapIncomeSchedule(row: TransactionRow) {
  return deserializeSchedule({
    start_date: row.start_date,
    next_occurrence: row.next_occurrence,
    last_processed_date: row.last_processed_date,
    recurring_status: row.recurring_status,
    frequency: row.frequency,
  });
}

function mapBillSchedule(row: BillRow) {
  return deserializeSchedule({
    start_date: row.start_date,
    next_occurrence: row.next_occurrence,
    last_processed_date: row.last_processed_date,
    recurring_status: row.recurring_status,
    frequency: row.bill_frequency,
  });
}

function mapGoalContribution(row: GoalRow): AutoContribution | undefined {
  if (!row.contribution_amount || !row.contribution_frequency) {
    return undefined;
  }

  const schedule = deserializeSchedule({
    start_date: row.start_date,
    next_occurrence: row.next_occurrence,
    last_processed_date: row.last_processed_date,
    recurring_status: row.recurring_status,
    frequency: row.contribution_frequency,
  });

  if (!schedule) {
    return undefined;
  }

  return {
    amount: toNumber(row.contribution_amount),
    frequency: row.contribution_frequency as AutoContribution["frequency"],
    schedule,
  };
}

function mapInvestmentContribution(row: AccountRow): AutoContribution | undefined {
  if (!row.monthly_contribution || !row.contribution_frequency) {
    return undefined;
  }

  const schedule = deserializeSchedule({
    start_date: row.start_date,
    next_occurrence: row.next_occurrence,
    last_processed_date: row.last_processed_date,
    recurring_status: row.recurring_status,
    frequency: row.contribution_frequency,
  });

  if (!schedule) {
    return undefined;
  }

  return {
    amount: toNumber(row.monthly_contribution),
    frequency: row.contribution_frequency as AutoContribution["frequency"],
    schedule,
  };
}

export function mapAccountRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    institution: row.institution,
    type: row.type as AccountType,
    balance: toNumber(row.balance),
    monthlyChange: toNumber(row.monthly_change),
  };
}

export function mapDebtRow(row: AccountRow): Debt {
  const balance = toNumber(row.balance);

  return {
    id: row.id,
    name: row.name,
    balance,
    originalBalance: toNumber(row.original_balance) || balance,
    interestRate: toNumber(row.interest_rate),
    minimumPayment: toNumber(row.minimum_payment),
    monthlyChange: toNumber(row.monthly_change),
    dueDay: row.due_day ?? 1,
    accountType: (row.type as DebtAccountType) || inferDebtAccountType(row.name),
  };
}

export function buildDebtInsert(userId: string, debt: Debt) {
  return {
    ...(debt.id ? { id: debt.id } : {}),
    user_id: userId,
    record_kind: "debt" as const,
    name: debt.name.trim(),
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
  };
}

export function buildDebtUpdate(debt: Debt) {
  return {
    name: debt.name.trim(),
    type: debt.accountType,
    balance: debt.balance,
    original_balance: debt.originalBalance,
    monthly_change: debt.monthlyChange,
    interest_rate: debt.interestRate,
    minimum_payment: debt.minimumPayment,
    due_day: debt.dueDay,
    updated_at: new Date().toISOString(),
  };
}

function mapInvestmentContributionFromRow(
  row: InvestmentRow | AccountRow,
): AutoContribution | undefined {
  if (!row.monthly_contribution || !row.contribution_frequency) {
    return undefined;
  }

  const schedule = deserializeSchedule({
    start_date: row.start_date,
    next_occurrence: row.next_occurrence,
    last_processed_date: row.last_processed_date,
    recurring_status: row.recurring_status,
    frequency: row.contribution_frequency,
  });

  if (!schedule) {
    return undefined;
  }

  return {
    amount: toNumber(row.monthly_contribution),
    frequency: row.contribution_frequency as AutoContribution["frequency"],
    schedule,
  };
}

export function mapInvestmentRow(row: InvestmentRow): Investment {
  return {
    id: row.id,
    name: row.name,
    value: toNumber(row.value),
    monthlyChange: toNumber(row.monthly_change),
    monthlyContribution: toNumber(row.monthly_contribution),
    type: row.type,
    autoContribution: mapInvestmentContributionFromRow(row),
  };
}

export function mapLegacyInvestmentRow(row: AccountRow): Investment {
  return {
    id: row.id,
    name: row.name,
    value: toNumber(row.balance),
    monthlyChange: toNumber(row.monthly_change),
    monthlyContribution: toNumber(row.monthly_contribution),
    type: row.type,
    autoContribution: mapInvestmentContribution(row),
  };
}

export function mapBillRow(row: BillRow): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: toNumber(row.amount),
    dueDay: row.due_day,
    autopay: row.autopay,
    recurring: row.recurring,
    category: row.category,
    paidMonth: row.paid_month,
    frequency: (row.bill_frequency ?? "monthly") as BillFrequency,
    schedule: mapBillSchedule(row),
  };
}

export function mapGoalRow(row: GoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    type: row.goal_type as GoalType,
    icon: row.icon,
    current: toNumber(row.current_amount),
    target: toNumber(row.target_amount),
    createdAt: row.created_at,
    autoContribution: mapGoalContribution(row),
  };
}

export function mapIncomeRow(row: TransactionRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    amount: toNumber(row.amount),
    frequency: normalizeIncomeFrequency(row.frequency ?? "monthly") as IncomeFrequency,
    category: row.category,
    schedule: mapIncomeSchedule(row),
  };
}

function isRecurringIncomeRow(row: TransactionRow): boolean {
  return row.transaction_type === "income" && row.frequency != null;
}

function isLedgerTransactionRow(row: TransactionRow): boolean {
  if (isRecurringIncomeRow(row)) {
    return false;
  }

  return (
    row.transaction_type === "income" ||
    row.transaction_type === "expense" ||
    row.transaction_type === "transfer"
  );
}

export function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    amount: toNumber(row.amount),
    type: row.transaction_type as LedgerTransactionType,
    category: row.category ?? "General",
    accountId: row.account_id ?? "",
    transferAccountId: row.transfer_to_account_id ?? null,
    date: row.transaction_date.split("T")[0] ?? row.transaction_date,
    notes: row.notes ?? row.name ?? "",
    goalId: row.goal_id,
  };
}

export function mapFinanceData(
  accountRows: AccountRow[],
  billRows: BillRow[],
  goalRows: GoalRow[],
  transactionRows: TransactionRow[],
  investmentRows: InvestmentRow[] = [],
  events: FinanceEvent[] = [],
): FinanceData {
  const recurringIncomeRows = transactionRows.filter(isRecurringIncomeRow);
  const ledgerRows = transactionRows.filter(isLedgerTransactionRow);

  const legacyInvestments = accountRows
    .filter((row) => row.record_kind === "investment")
    .map(mapLegacyInvestmentRow);

  const mapped: FinanceData = {
    accounts: accountRows
      .filter((row) => row.record_kind === "account")
      .map(mapAccountRow),
    debts: accountRows
      .filter((row) => row.record_kind === "debt")
      .map(mapDebtRow),
    investments:
      investmentRows.length > 0
        ? investmentRows.map(mapInvestmentRow)
        : legacyInvestments,
    bills: billRows.map(mapBillRow),
    savingsGoals: goalRows.map(mapGoalRow),
    income: recurringIncomeRows.map(mapIncomeRow),
    transactions: ledgerRows.map(mapTransactionRow),
    events,
  };

  return normalizeRecurringFinanceData(mapped);
}

export function buildAccountUpdate(row: Account, investment?: Investment) {
  const autoContribution = investment?.autoContribution;

  return {
    balance: row.balance,
    monthly_change: row.monthlyChange,
    ...(autoContribution
      ? {
          monthly_contribution: autoContribution.amount,
          contribution_frequency: autoContribution.frequency,
          ...serializeSchedule(autoContribution.schedule),
        }
      : {}),
    updated_at: new Date().toISOString(),
  };
}

export function buildInvestmentUpdate(investment: Investment) {
  const autoContribution = investment.autoContribution;

  return {
    value: investment.value,
    monthly_change: investment.monthlyChange,
    monthly_contribution:
      autoContribution?.amount ?? investment.monthlyContribution,
    contribution_frequency: autoContribution?.frequency ?? null,
    ...(autoContribution
      ? serializeSchedule(autoContribution.schedule)
      : {}),
    updated_at: new Date().toISOString(),
  };
}

export function buildBillUpdate(bill: Bill) {
  return {
    name: bill.name,
    amount: bill.amount,
    due_day: bill.dueDay,
    autopay: bill.autopay,
    recurring: bill.recurring,
    category: bill.category,
    paid_month: bill.paidMonth,
    bill_frequency: bill.frequency ?? bill.schedule?.frequency ?? "monthly",
    ...(bill.schedule ? serializeSchedule(bill.schedule) : {}),
    updated_at: new Date().toISOString(),
  };
}

export function buildGoalUpdate(goal: SavingsGoal) {
  return {
    name: goal.name,
    goal_type: goal.type,
    icon: goal.icon,
    current_amount: goal.current,
    target_amount: goal.target,
    contribution_amount: goal.autoContribution?.amount ?? null,
    contribution_frequency: goal.autoContribution?.frequency ?? null,
    ...(goal.autoContribution
      ? serializeSchedule(goal.autoContribution.schedule)
      : {}),
    updated_at: new Date().toISOString(),
  };
}

export function buildIncomeUpdate(income: IncomeSource) {
  return {
    name: income.name,
    amount: income.amount,
    frequency: income.frequency,
    category: income.category,
    ...(income.schedule ? serializeSchedule(income.schedule) : {}),
    updated_at: new Date().toISOString(),
  };
}

export function buildTransactionInsert(
  userId: string,
  transaction: Transaction,
) {
  return {
    ...(transaction.id ? { id: transaction.id } : {}),
    user_id: userId,
    transaction_type: transaction.type,
    name: (transaction.notes ?? "").trim() || transaction.category || "Transaction",
    amount: transaction.amount,
    category: transaction.category,
    account_id: transaction.accountId,
    transfer_to_account_id: transaction.transferAccountId,
    goal_id: transaction.goalId ?? null,
    notes: transaction.notes,
    transaction_date: transaction.date,
    frequency: null,
  };
}

export function buildTransactionUpdate(transaction: Transaction) {
  return {
    transaction_type: transaction.type,
    name: (transaction.notes ?? "").trim() || transaction.category || "Transaction",
    amount: transaction.amount,
    category: transaction.category,
    account_id: transaction.accountId,
    transfer_to_account_id: transaction.transferAccountId,
    goal_id: transaction.goalId ?? null,
    notes: transaction.notes,
    transaction_date: transaction.date,
    updated_at: new Date().toISOString(),
  };
}

export {
  normalizeRecurringFinanceData,
  serializeSchedule,
};
