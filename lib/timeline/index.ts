import type { TimelineSeries } from "./types";

export type {
  FinancialMilestone,
  TimelinePoint,
  TimelineRange,
  TimelineSeries,
  TimelineSeriesKey,
} from "./types";
export { buildTimeline } from "./buildTimeline";
export {
  formatMilestoneDate,
  generateMilestones,
} from "./generateMilestones";

export const TIMELINE_SERIES: TimelineSeries[] = [
  { key: "netWorth", label: "Net Worth", color: "#0077ed" },
  { key: "cash", label: "Cash", color: "#4da3ff" },
  { key: "debt", label: "Debt", color: "#2563eb" },
  { key: "investments", label: "Investments", color: "#1d4ed8" },
];
