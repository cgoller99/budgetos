export type TimelineRange = "weekly" | "monthly" | "yearly";

export type TimelinePoint = {
  date: Date;
  label: string;
  netWorth: number;
  cash: number;
  debt: number;
  investments: number;
};

export type FinancialMilestone = {
  id: string;
  date: Date;
  icon: string;
  achievement: string;
  description: string;
};

export type TimelineSeriesKey = "netWorth" | "cash" | "debt" | "investments";

export type TimelineSeries = {
  key: TimelineSeriesKey;
  label: string;
  color: string;
};
