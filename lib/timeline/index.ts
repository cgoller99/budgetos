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
  { key: "netWorth", label: "Net Worth", color: "#3B82F6" },
  { key: "cash", label: "Cash", color: "#60A5FA" },
  { key: "debt", label: "Debt", color: "#EF4444" },
  { key: "investments", label: "Investments", color: "#8B5CF6" },
];
