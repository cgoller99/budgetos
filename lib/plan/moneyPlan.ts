import {
  budgetMonthlyEquivalent,
  currentBudgetPeriod,
  normalizeBudgetSchedule,
  roundBudgetCurrency,
  type BudgetFrequency,
} from "@/lib/budgets/budgetPeriod";
import { getUpcomingBills, getCurrentYearMonth } from "@/lib/finance/bills";
import { formatDebtDueDate, getTotalMinimumPayments } from "@/lib/finance/debts";
import { formatCurrency } from "@/lib/finance/format";
import { calculateMoneyFlow, type MoneyFlowBreakdownLine } from "@/lib/finance/moneyFlow";
import { normalizeRecurringFinanceData } from "@/lib/recurring";
import {
  filterPersonalIncomePlan,
  isPersonalOwnerRow,
} from "@/lib/finance/personalIncomeScope";
import type { FinanceData } from "@/lib/finance/types";
import { describePaySchedule, resolveUpcomingPayDate } from "@/lib/incomePlan/payDates";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";

const EXCLUDED_BUDGET_CATEGORIES = new Set([
  "Transfers",
  "Income",
  "Payroll",
  "Interest",
  "Refund",
  "Credit Card Payment",
  "Loan Payment",
]);

export type MoneyPlanBudgetLimit = {
  category: string;
  amount: number;
  frequency?: BudgetFrequency;
  anchorDate?: string | null;
  weekday?: number | null;
  monthDays?: number[] | [number, number] | null;
  intervalDays?: number | null;
};

export type MoneyPlanBudgetRow = {
  category: string;
  limit: number;
  spent: number;
  remaining: number;
  over: boolean;
  detail: string;
};

export type MoneyPlan = {
  month: string;
  stages: MoneyFlowBreakdownLine[];
  safeToSpend: number;
  debtMinimums: number;
  incomePlan: {
    paycheckAmount: number;
    nextPayDate: string;
    scheduleLabel: string;
    allocations: Array<{ id: string; name: string; amountLabel: string }>;
  } | null;
  bills: Array<{ id: string; name: string; amount: number; dueLabel: string }>;
  debts: Array<{ id: string; name: string; minimumPayment: number; dueLabel: string }>;
  goals: Array<{ id: string; name: string; current: number; target: number; remaining: number }>;
  budgets: MoneyPlanBudgetRow[];
  /** Sum of one monthly equivalent per category, beside the unchanged Safe to Spend waterfall. */
  monthlyBudgetTotal: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Read-only assembly of the current Income Plan, bills, debt, goals,
 * saved budgets, and monthly cash-flow waterfall.
 * It does not create transactions or change a plan.
 */
export function buildMoneyPlan(
  data: FinanceData,
  referenceDate = new Date(),
  budgets: MoneyPlanBudgetLimit[] = [],
): MoneyPlan {
  const flow = calculateMoneyFlow(normalizeRecurringFinanceData(data, referenceDate));
  const month = getCurrentYearMonth(referenceDate);
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);

  const limits = new Map<
    string,
    { amount: number; schedule: ReturnType<typeof normalizeBudgetSchedule> }
  >();
  for (const budget of budgets) {
    const category = getDisplayCategory(budget.category);
    if (
      EXCLUDED_BUDGET_CATEGORIES.has(category) ||
      !Number.isFinite(budget.amount) ||
      budget.amount <= 0
    ) {
      continue;
    }
    const schedule = normalizeBudgetSchedule(budget);
    const existing = limits.get(category);
    if (existing == null || budget.amount < existing.amount) {
      limits.set(category, { amount: budget.amount, schedule });
    }
  }

  function spentFor(schedule: ReturnType<typeof normalizeBudgetSchedule>): Map<string, number> {
    const period = currentBudgetPeriod(schedule, referenceDate);
    const spent = new Map<string, number>();
    for (const transaction of data.transactions ?? []) {
      const posted = transaction.date.slice(0, 10);
      const inWindow =
        schedule.frequency === "monthly"
          ? transaction.date.slice(0, 7) === month
          : posted >= period.start && posted <= period.end;
      if (
        !inWindow ||
        transaction.type !== "expense" ||
        transaction.amount === 0 ||
        transaction.goalId ||
        !isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId) ||
        isConfidentInternalTransfer(data, transaction)
      ) {
        continue;
      }
      const category = getDisplayCategory(transaction.category);
      if (EXCLUDED_BUDGET_CATEGORIES.has(category)) {
        continue;
      }
      spent.set(category, (spent.get(category) ?? 0) + transaction.amount);
    }
    return spent;
  }

  return {
    month,
    stages: flow.breakdown,
    safeToSpend: flow.safeToSpend,
    debtMinimums: roundCurrency(getTotalMinimumPayments(data)),
    incomePlan:
      plan && plan.isActive
        ? {
            paycheckAmount: plan.paycheckAmount,
            nextPayDate: resolveUpcomingPayDate(plan, referenceDate),
            scheduleLabel: describePaySchedule(plan),
            allocations: plan.allocations.map((allocation) => ({
              id: allocation.id,
              name: allocation.name,
              amountLabel: allocation.isRemainingBalance
                ? "Remainder of the paycheck"
                : formatCurrency(allocation.amount ?? 0),
            })),
          }
        : null,
    bills: getUpcomingBills(data, referenceDate)
      .slice(0, 5)
      .map((bill) => ({
        id: bill.splitId,
        name: bill.name,
        amount: bill.remainingAmount,
        dueLabel: bill.formattedDueDate,
      })),
    debts: (data.debts ?? [])
      .filter((debt) => debt.balance > 0 && debt.minimumPayment > 0)
      .map((debt) => ({
        id: debt.id,
        name: debt.name,
        minimumPayment: debt.minimumPayment,
        dueLabel: formatDebtDueDate(debt.dueDay, referenceDate),
      })),
    goals: (data.savingsGoals ?? [])
      .filter((goal) => goal.current < goal.target)
      .map((goal) => ({
        id: goal.id,
        name: goal.name,
        current: goal.current,
        target: goal.target,
        remaining: roundCurrency(Math.max(goal.target - goal.current, 0)),
      })),
    budgets: [...limits.entries()].map(([category, entry]) => {
      const period = currentBudgetPeriod(entry.schedule, referenceDate);
      const amount = roundCurrency(spentFor(entry.schedule).get(category) ?? 0);
      const remaining = roundCurrency(entry.amount - amount);
      const detail =
        entry.schedule.frequency === "monthly"
          ? `${formatCurrency(amount)} of confirmed ${category} expenses posted in ${month} against a saved ${formatCurrency(entry.amount)} limit.`
          : `${formatCurrency(amount)} of confirmed ${category} expenses posted from ${period.start} to ${period.end} against a saved ${formatCurrency(entry.amount)} limit.`;
      return {
        category,
        limit: entry.amount,
        spent: amount,
        remaining,
        over: amount > entry.amount,
        detail,
      };
    }),
    monthlyBudgetTotal: roundBudgetCurrency(
      [...limits.values()].reduce(
        (total, entry) => total + budgetMonthlyEquivalent(entry.amount, entry.schedule),
        0,
      ),
    ),
  };
}
