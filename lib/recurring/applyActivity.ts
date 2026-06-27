import { getCurrentYearMonth } from "@/lib/finance/bills";
import { isCashAccountType } from "@/lib/finance/accountTypes";
import type { FinanceData } from "@/lib/finance/types";
import { parseActivityId } from "@/lib/recurring/generateTodayActivity";
import { markScheduleProcessed } from "@/lib/recurring/schedule";
import type { TodayActivity } from "@/lib/recurring/types";

function getPrimaryCashAccount(data: FinanceData) {
  return (
    data.accounts.find((account) => account.type === "checking") ??
    data.accounts.find((account) => isCashAccountType(account.type)) ??
    data.accounts[0]
  );
}

function adjustCashBalance(
  data: FinanceData,
  delta: number,
): FinanceData["accounts"] {
  const account = getPrimaryCashAccount(data);

  if (!account) {
    return data.accounts;
  }

  return data.accounts.map((item) =>
    item.id === account.id
      ? { ...item, balance: Math.max(0, item.balance + delta) }
      : item,
  );
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

  return {
    ...data,
    accounts: adjustCashBalance(data, income.amount),
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

function applyBillActivity(
  data: FinanceData,
  entityId: string,
  referenceDate: Date,
): FinanceData {
  const bill = data.bills.find((item) => item.id === entityId);

  if (!bill?.schedule) {
    return data;
  }

  return {
    ...data,
    accounts: adjustCashBalance(data, -bill.amount),
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

  const nextAmount = Math.min(goal.current + contribution.amount, goal.target);

  return {
    ...data,
    accounts: adjustCashBalance(data, -contribution.amount),
    savingsGoals: data.savingsGoals.map((item) =>
      item.id === entityId
        ? {
            ...item,
            current: nextAmount,
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

  return {
    ...data,
    accounts: adjustCashBalance(data, -contribution.amount),
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
