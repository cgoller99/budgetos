import { getCurrentYearMonth } from "@/lib/finance/bills";
import { resolvePaymentAccountId } from "@/lib/finance/balanceEffects";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { parseActivityId } from "@/lib/recurring/generateTodayActivity";
import { markScheduleProcessed } from "@/lib/recurring/schedule";
import type { TodayActivity } from "@/lib/recurring/types";
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

function applyIncomeActivity(
  data: FinanceData,
  entityId: string,
  referenceDate: Date,
): FinanceData {
  const income = data.income.find((item) => item.id === entityId);

  if (!income?.schedule) {
    return data;
  }

  const accountId = resolvePaymentAccountId(data, income.depositAccountId);

  if (!accountId) {
    return {
      ...data,
      income: data.income.map((item) =>
        item.id === entityId
          ? {
              ...item,
              schedule: markScheduleProcessed(item.schedule!, referenceDate),
            }
          : item,
      ),
    };
  }

  const date =
    referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString();
  const transaction = createTransaction({
    amount: income.amount,
    type: "income",
    category: income.category,
    accountId,
    transferAccountId: null,
    date,
    notes: `${income.name} paycheck received`,
  });

  let next: FinanceData = {
    ...data,
    transactions: [transaction, ...data.transactions],
    income: data.income.map((item) =>
      item.id === entityId
        ? {
            ...item,
            schedule: markScheduleProcessed(item.schedule!, referenceDate),
          }
        : item,
    ),
  };

  next = applyTransactionEffect(next, transaction);
  return next;
}

function applyBillActivity(
  data: FinanceData,
  entityId: string,
  referenceDate: Date,
): FinanceData {
  const bill = data.bills.find((item) => item.id === entityId);

  if (!bill?.schedule) {
    return data;
  }

  const accountId = resolvePaymentAccountId(data, bill.paymentAccountId);
  const date =
    referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString();

  let next: FinanceData = {
    ...data,
    bills: data.bills.map((item) =>
      item.id === entityId
        ? {
            ...item,
            paidMonth: getCurrentYearMonth(referenceDate),
            schedule: markScheduleProcessed(item.schedule!, referenceDate),
          }
        : item,
    ),
  };

  if (!accountId) {
    return next;
  }

  const transaction = createTransaction({
    amount: bill.amount,
    type: "expense",
    category: bill.category,
    accountId,
    transferAccountId: null,
    date,
    notes: `${bill.name} bill payment`,
    billId: bill.id,
  });

  next = {
    ...next,
    transactions: [transaction, ...next.transactions],
  };
  next = applyTransactionEffect(next, transaction);
  return next;
}

function applyGoalActivity(
  data: FinanceData,
  entityId: string,
  referenceDate: Date,
): FinanceData {
  const goal = data.savingsGoals.find((item) => item.id === entityId);
  const contribution = goal?.autoContribution;

  if (!goal || !contribution) {
    return data;
  }

  const accountId = resolvePaymentAccountId(data, null);
  const date =
    referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString();

  let next: FinanceData = {
    ...data,
    savingsGoals: data.savingsGoals.map((item) =>
      item.id === entityId
        ? {
            ...item,
            current: Math.min(item.current + contribution.amount, item.target),
            autoContribution: {
              ...contribution,
              schedule: markScheduleProcessed(
                contribution.schedule,
                referenceDate,
              ),
            },
          }
        : item,
    ),
  };

  if (!accountId) {
    return next;
  }

  const transaction = createTransaction({
    amount: contribution.amount,
    type: "expense",
    category: "Goal Contribution",
    accountId,
    transferAccountId: null,
    date,
    notes: `Recurring savings contribution to ${goal.name}`,
    goalId: goal.id,
  });

  next = {
    ...next,
    transactions: [transaction, ...next.transactions],
  };
  next = applyTransactionEffect(next, transaction);
  next = applyGoalContributionEffect(next, transaction);
  return next;
}

function applyInvestmentActivity(
  data: FinanceData,
  entityId: string,
  referenceDate: Date,
): FinanceData {
  const investment = data.investments.find((item) => item.id === entityId);
  const contribution = investment?.autoContribution;

  if (!investment || !contribution) {
    return data;
  }

  const accountId = resolvePaymentAccountId(data, null);

  if (!accountId) {
    return {
      ...data,
      investments: data.investments.map((item) =>
        item.id === entityId
          ? {
              ...item,
              value: item.value + contribution.amount,
              autoContribution: {
                ...contribution,
                schedule: markScheduleProcessed(
                  contribution.schedule,
                  referenceDate,
                ),
              },
            }
          : item,
      ),
    };
  }

  const date =
    referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString();
  const transaction = createTransaction({
    amount: contribution.amount,
    type: "expense",
    category: "Investment Contribution",
    accountId,
    transferAccountId: null,
    date,
    notes: `${investment.name} contribution`,
  });

  let next: FinanceData = {
    ...data,
    transactions: [transaction, ...data.transactions],
    investments: data.investments.map((item) =>
      item.id === entityId
        ? {
            ...item,
            value: item.value + contribution.amount,
            autoContribution: {
              ...contribution,
              schedule: markScheduleProcessed(
                contribution.schedule,
                referenceDate,
              ),
            },
          }
        : item,
    ),
  };

  next = applyTransactionEffect(next, transaction);
  return next;
}

export function applyActivityToData(
  data: FinanceData,
  activityId: string,
  referenceDate = new Date(),
): FinanceData {
  const parsed = parseActivityId(activityId);

  if (!parsed) {
    return data;
  }

  switch (parsed.entityType) {
    case "income":
      return applyIncomeActivity(data, parsed.entityId, referenceDate);
    case "bill":
      return applyBillActivity(data, parsed.entityId, referenceDate);
    case "goal":
      return applyGoalActivity(data, parsed.entityId, referenceDate);
    case "investment":
      return applyInvestmentActivity(data, parsed.entityId, referenceDate);
    default:
      return data;
  }
}

export function applyAllActivitiesToData(
  data: FinanceData,
  activities: TodayActivity[],
  referenceDate = new Date(),
): FinanceData {
  return activities.reduce(
    (current, activity) => applyActivityToData(current, activity.id, referenceDate),
    data,
  );
}
