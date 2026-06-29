import { resolvePaymentAccountId } from "@/lib/finance/balanceEffects";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { advancePayDate, computeNextPayDate } from "@/lib/incomePlan/payDates";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanPaycheckEvent,
  MarkPaycheckReceivedInput,
} from "@/lib/incomePlan/types";
import {
  applyGoalContributionEffect,
  applyTransactionEffect,
} from "@/lib/transactions/applyTransactionEffects";

function createTransaction(
  partial: Omit<Transaction, "id"> & { id?: string },
): Transaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    amount: partial.amount,
    type: partial.type,
    category: partial.category,
    accountId: partial.accountId,
    transferAccountId: partial.transferAccountId ?? null,
    date: partial.date,
    notes: partial.notes,
    goalId: partial.goalId ?? null,
    billId: partial.billId ?? null,
    debtId: partial.debtId ?? null,
  };
}

function moveAllocationAmount(
  data: FinanceData,
  params: {
    allocation: IncomePlanAllocation;
    amount: number;
    depositAccountId: string;
    date: string;
  },
): { data: FinanceData; transactionId: string | null } {
  const { allocation, amount, depositAccountId, date } = params;

  if (amount <= 0) {
    return { data, transactionId: null };
  }

  if (allocation.goalId) {
    const goal = data.savingsGoals.find((item) => item.id === allocation.goalId);
    const transaction = createTransaction({
      amount,
      type: "expense",
      category: "Goal Contribution",
      accountId: depositAccountId,
      transferAccountId: null,
      date,
      notes: goal
        ? `Income Plan → ${goal.name}`
        : `Income Plan → ${allocation.name}`,
      goalId: allocation.goalId,
    });

    let next: FinanceData = {
      ...data,
      transactions: [transaction, ...data.transactions],
    };
    next = applyTransactionEffect(next, transaction);
    next = applyGoalContributionEffect(next, transaction);

    return { data: next, transactionId: transaction.id };
  }

  if (allocation.accountId && allocation.accountId !== depositAccountId) {
    const transaction = createTransaction({
      amount,
      type: "transfer",
      category: allocation.name,
      accountId: depositAccountId,
      transferAccountId: allocation.accountId,
      date,
      notes: `Income Plan → ${allocation.name}`,
    });

    let next: FinanceData = {
      ...data,
      transactions: [transaction, ...data.transactions],
    };
    next = applyTransactionEffect(next, transaction);

    return { data: next, transactionId: transaction.id };
  }

  return { data, transactionId: null };
}

export function applyIncomePlanPaycheckToData(
  data: FinanceData,
  plan: IncomePlan,
  input: MarkPaycheckReceivedInput = {},
  referenceDate = new Date(),
): {
  data: FinanceData;
  paycheckEvent: IncomePlanPaycheckEvent;
} {
  if (!plan.isActive) {
    throw new Error("Income plan is not active.");
  }

  const depositAccountId = resolvePaymentAccountId(
    data,
    plan.depositAccountId,
  );

  if (!depositAccountId) {
    throw new Error("Add a checking account to receive paychecks.");
  }

  const payDate = plan.nextPayDate;
  const date =
    referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString();
  const resolved = resolveAllocationAmounts(plan, input.customAllocations);
  const paycheckEventId = crypto.randomUUID();

  const incomeTransaction = createTransaction({
    amount: plan.paycheckAmount,
    type: "income",
    category: "Paycheck",
    accountId: depositAccountId,
    transferAccountId: null,
    date,
    notes: "Income Plan paycheck received",
  });

  let next: FinanceData = {
    ...data,
    transactions: [incomeTransaction, ...data.transactions],
  };
  next = applyTransactionEffect(next, incomeTransaction);

  const allocationEvents: IncomePlanPaycheckEvent["allocationEvents"] = [];

  for (const { allocation, amount } of resolved) {
    const moved = moveAllocationAmount(next, {
      allocation,
      amount,
      depositAccountId,
      date,
    });

    next = moved.data;

    allocationEvents.push({
      id: crypto.randomUUID(),
      allocationId: allocation.id,
      amount,
      transactionId: moved.transactionId,
    });
  }

  const updatedPlan: IncomePlan = {
    ...plan,
    lastProcessedDate: payDate,
    nextPayDate: advancePayDate(plan),
  };

  const paycheckEvent: IncomePlanPaycheckEvent = {
    id: paycheckEventId,
    incomePlanId: plan.id,
    payDate,
    grossAmount: plan.paycheckAmount,
    isExtraPaycheck: input.isExtraPaycheck ?? false,
    incomeTransactionId: incomeTransaction.id,
    allocationEvents,
  };

  return {
    data: {
      ...next,
      incomePlan: updatedPlan,
      incomePlanPaychecks: [paycheckEvent, ...(data.incomePlanPaychecks ?? [])],
    },
    paycheckEvent,
  };
}

export function buildInitialIncomePlan(
  input: {
    paySchedule: IncomePlan["paySchedule"];
    paycheckAmount: number;
    anchorDate: string;
    weeklyDayOfWeek: number | null;
    monthlyDays: number[];
    customIntervalDays: number | null;
    depositAccountId: string | null;
    allocations: IncomePlan["allocations"];
  },
  referenceDate = new Date(),
): IncomePlan {
  return {
    id: crypto.randomUUID(),
    paySchedule: input.paySchedule,
    paycheckAmount: input.paycheckAmount,
    anchorDate: input.anchorDate,
    weeklyDayOfWeek: input.weeklyDayOfWeek,
    monthlyDays: input.monthlyDays,
    customIntervalDays: input.customIntervalDays,
    depositAccountId: input.depositAccountId,
    nextPayDate: computeNextPayDate(
      input.paySchedule,
      input.anchorDate,
      referenceDate,
      {
        weeklyDayOfWeek: input.weeklyDayOfWeek,
        monthlyDays: input.monthlyDays,
        customIntervalDays: input.customIntervalDays,
      },
    ),
    lastProcessedDate: null,
    isActive: true,
    allocations: input.allocations.map((allocation, index) => ({
      ...allocation,
      id: allocation.id || crypto.randomUUID(),
      sortOrder: allocation.sortOrder ?? index,
    })),
  };
}
