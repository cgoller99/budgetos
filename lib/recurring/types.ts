export type RecurringStatus = "active" | "paused";

export type IncomeFrequency =
  | "weekly"
  | "biweekly"
  | "every_2_weeks"
  | "twice_monthly"
  | "monthly"
  | "yearly";

export type BillFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export type ContributionFrequency = "weekly" | "biweekly" | "monthly";

export type RecurringSchedule = {
  startDate: string;
  frequency: string;
  nextOccurrence: string;
  lastProcessedDate: string | null;
  status: RecurringStatus;
};

export type AutoContribution = {
  amount: number;
  frequency: ContributionFrequency;
  schedule: RecurringSchedule;
};

export type RecurringEntityType = "income" | "bill" | "goal" | "investment";

export type TodayActivity = {
  id: string;
  entityType: RecurringEntityType;
  entityId: string;
  icon: string;
  label: string;
  amount: number;
  applied: boolean;
};

export type TodayActivitySummary = {
  activities: TodayActivity[];
  pendingCount: number;
};
