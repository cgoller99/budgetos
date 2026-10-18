/**
 * Paycheck allocation breakdown for the Budgets planning dashboard.
 * Source of truth: active Income Plan rows (stable IDs). Planned ≠ confirmed cash.
 */
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import { weeklySavingsFromPaycheckAmount } from "@/lib/finance/goalForecast";
import { getAllocationProgress, resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { FinanceData } from "@/lib/finance/types";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";

export type PaycheckBreakdownRow = {
  allocationId: string;
  name: string;
  icon: string;
  amountPerPaycheck: number;
  amountWeekly: number;
  percentOfPaycheck: number;
  accountId: string | null;
  accountName: string | null;
  accountBalance: number | null;
  accountLastSyncedAt: string | null;
  goalId: string | null;
  goalName: string | null;
  billId: string | null;
  debtId: string | null;
  /** Confirmed allocation receipts this calendar month (planned until confirmed). */
  contributedThisMonth: number;
  monthlyTarget: number;
  remainingMonthlyAllowance: number;
  kind: "goal" | "bill" | "debt" | "flexible" | "remaining" | "other";
  purposeNote: string | null;
};

export type PaycheckBreakdown = {
  hasPlan: boolean;
  paycheckAmount: number;
  paySchedule: IncomePlanSchedule | null;
  rows: PaycheckBreakdownRow[];
  totalAllocated: number;
  unallocated: number;
  explanation: string;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function classify(
  allocation: {
    isRemainingBalance: boolean;
    goalId: string | null;
    debtId?: string | null;
    billId?: string | null;
  },
): PaycheckBreakdownRow["kind"] {
  if (allocation.isRemainingBalance) return "remaining";
  if (allocation.goalId) return "goal";
  if (allocation.debtId) return "debt";
  if (allocation.billId) return "bill";
  return "flexible";
}

export function buildPaycheckBreakdown(
  data: FinanceData,
  referenceDate = new Date(),
): PaycheckBreakdown {
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  if (!plan?.isActive || plan.paycheckAmount <= 0) {
    return {
      hasPlan: false,
      paycheckAmount: 0,
      paySchedule: plan?.paySchedule ?? null,
      rows: [],
      totalAllocated: 0,
      unallocated: 0,
      explanation:
        "No active Income Plan. Category budgets and Safe to Spend still work from cash and bills.",
    };
  }

  const paycheckAmount = round(plan.paycheckAmount);
  const resolved = resolveAllocationAmounts({
    paycheckAmount,
    allocations: plan.allocations,
  });
  const progress = getAllocationProgress(
    plan,
    data.incomePlanPaychecks ?? [],
    referenceDate,
  );
  const progressById = new Map(progress.map((item) => [item.allocationId, item]));
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));
  const goalsById = new Map(
    (data.savingsGoals ?? []).map((goal) => [goal.id, goal]),
  );

  const rows: PaycheckBreakdownRow[] = resolved.map((item) => {
    const allocation = item.allocation;
    const amount = round(item.amount);
    const weekly =
      weeklySavingsFromPaycheckAmount(
        amount,
        plan.paySchedule,
        plan.customIntervalDays,
      ) ?? 0;
    const account = allocation.accountId
      ? accountsById.get(allocation.accountId) ?? null
      : null;
    const goal = allocation.goalId ? goalsById.get(allocation.goalId) ?? null : null;
    const prog = progressById.get(allocation.id);
    const contributed = round(prog?.receivedThisMonth ?? 0);
    const monthlyTarget = round(prog?.monthlyTarget ?? 0);
    const kind = classify(allocation);
    let purposeNote: string | null = null;
    if (/rent/i.test(allocation.name) && account) {
      purposeNote =
        "Rent reserve parked in this account for planning — not investment gains or a rent payment.";
    }
    if (kind === "goal" && account) {
      purposeNote =
        purposeNote ??
        "Goal contributions stay planned until a paycheck is confirmed.";
    }

    return {
      allocationId: allocation.id,
      name: allocation.name,
      icon: allocation.icon || "💵",
      amountPerPaycheck: amount,
      amountWeekly: round(weekly),
      percentOfPaycheck:
        paycheckAmount > 0 ? round((amount / paycheckAmount) * 100) : 0,
      accountId: allocation.accountId,
      accountName: account?.name ?? null,
      accountBalance: account ? round(account.balance) : null,
      accountLastSyncedAt: account?.lastSyncedAt ?? null,
      goalId: allocation.goalId,
      goalName: goal?.name ?? null,
      billId: allocation.billId ?? null,
      debtId: allocation.debtId ?? null,
      contributedThisMonth: contributed,
      monthlyTarget,
      remainingMonthlyAllowance: round(Math.max(0, monthlyTarget - contributed)),
      kind,
      purposeNote,
    };
  });

  const totalAllocated = round(rows.reduce((sum, row) => sum + row.amountPerPaycheck, 0));
  const unallocated = round(Math.max(0, paycheckAmount - totalAllocated));

  return {
    hasPlan: true,
    paycheckAmount,
    paySchedule: plan.paySchedule,
    rows,
    totalAllocated,
    unallocated,
    explanation:
      "Amounts are from your saved Income Plan. Confirmed column uses paycheck allocation events this month — planned rows are not cash until confirmed.",
  };
}
