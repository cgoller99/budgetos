import { runIncomePlan } from "@/lib/allocation/paycheckEngine";
import type { FinanceData } from "@/lib/finance/types";
import { computeNextPayDate } from "@/lib/incomePlan/payDates";
import type {
  IncomePlan,
  IncomePlanPaycheckEvent,
  MarkPaycheckReceivedInput,
} from "@/lib/incomePlan/types";

export function applyIncomePlanPaycheckToData(
  data: FinanceData,
  plan: IncomePlan,
  input: MarkPaycheckReceivedInput = {},
  referenceDate = new Date(),
): {
  data: FinanceData;
  paycheckEvent: IncomePlanPaycheckEvent;
} {
  const result = runIncomePlan(data, plan, input, referenceDate);

  return {
    data: result.data,
    paycheckEvent: result.paycheckEvent,
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
      percentage: allocation.percentage ?? null,
      allocationType: allocation.allocationType ?? null,
      billId: allocation.billId ?? null,
      debtId: allocation.debtId ?? null,
      investmentId: allocation.investmentId ?? null,
      contributionFrequency: allocation.contributionFrequency ?? null,
    })),
  };
}
