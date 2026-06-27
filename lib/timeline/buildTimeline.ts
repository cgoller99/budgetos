import {
  calculateNetWorthBreakdown,
  calculatePropertyAssets,
} from "@/lib/calculations/netWorth";
import type { FinanceData } from "@/lib/finance/types";
import type { TimelinePoint, TimelineRange } from "./types";

const RANGE_CONFIG: Record<
  TimelineRange,
  { count: number; unitMs: number; changeDivisor: number }
> = {
  weekly: {
    count: 12,
    unitMs: 7 * 86_400_000,
    changeDivisor: 4.33,
  },
  monthly: {
    count: 12,
    unitMs: 30 * 86_400_000,
    changeDivisor: 1,
  },
  yearly: {
    count: 5,
    unitMs: 365 * 86_400_000,
    changeDivisor: 1 / 12,
  },
};

function formatTimelineLabel(date: Date, range: TimelineRange): string {
  if (range === "yearly") {
    return date.toLocaleDateString("en-US", { year: "numeric" });
  }

  if (range === "monthly") {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function projectValue(
  current: number,
  monthlyChange: number,
  periodsFromNow: number,
  changeDivisor: number,
): number {
  const delta = (monthlyChange / changeDivisor) * periodsFromNow;
  return Math.max(0, Math.round(current - delta));
}

export function buildTimeline(
  data: FinanceData,
  range: TimelineRange,
  referenceDate = new Date(),
): TimelinePoint[] {
  const config = RANGE_CONFIG[range];
  const breakdown = calculateNetWorthBreakdown(data);
  const property = calculatePropertyAssets(data);

  const points: TimelinePoint[] = [];

  for (let index = 0; index < config.count; index += 1) {
    const periodsFromNow = config.count - 1 - index;
    const date = new Date(referenceDate.getTime() - periodsFromNow * config.unitMs);

    const cash = projectValue(
      breakdown.cash.value,
      breakdown.cash.monthlyChange,
      periodsFromNow,
      config.changeDivisor,
    );
    const investments = projectValue(
      breakdown.investments.value,
      breakdown.investments.monthlyChange,
      periodsFromNow,
      config.changeDivisor,
    );
    const debt = projectValue(
      breakdown.debt.value,
      breakdown.debt.monthlyChange,
      periodsFromNow,
      config.changeDivisor,
    );
    const propertyValue = projectValue(
      property.value,
      property.monthlyChange,
      periodsFromNow,
      config.changeDivisor,
    );

    points.push({
      date,
      label: formatTimelineLabel(date, range),
      cash,
      investments,
      debt,
      netWorth: cash + investments + propertyValue - debt,
    });
  }

  return points;
}

export { RANGE_CONFIG };
