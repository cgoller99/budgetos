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
  { key: "netWorth", label: "Net Worth", color: "#34d399" },
  { key: "cash", label: "Cash", color: "#60a5fa" },
  { key: "debt", label: "Debt", color: "#fb7185" },
  { key: "investments", label: "Investments", color: "#a78bfa" },
];
