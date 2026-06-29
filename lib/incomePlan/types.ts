export type IncomePlanSchedule =
  | "weekly"
  | "biweekly"
  | "twice_monthly"
  | "monthly"
  | "custom";

export type IncomePlanAllocation = {
  id: string;
  name: string;
  icon: string;
  amount: number | null;
  isRemainingBalance: boolean;
  accountId: string | null;
  goalId: string | null;
  monthlyTarget: number | null;
  sortOrder: number;
};

export type IncomePlan = {
  id: string;
  paySchedule: IncomePlanSchedule;
  paycheckAmount: number;
  anchorDate: string;
  weeklyDayOfWeek: number | null;
  monthlyDays: number[];
  customIntervalDays: number | null;
  depositAccountId: string | null;
  nextPayDate: string;
  lastProcessedDate: string | null;
  isActive: boolean;
  allocations: IncomePlanAllocation[];
};

export type IncomePlanAllocationEvent = {
  id: string;
  allocationId: string;
  amount: number;
  transactionId: string | null;
};

export type IncomePlanPaycheckEvent = {
  id: string;
  incomePlanId: string;
  payDate: string;
  grossAmount: number;
  isExtraPaycheck: boolean;
  incomeTransactionId: string | null;
  allocationEvents: IncomePlanAllocationEvent[];
};

export type ResolvedAllocation = {
  allocation: IncomePlanAllocation;
  amount: number;
};

export type IncomePlanAllocationProgress = {
  allocationId: string;
  name: string;
  icon: string;
  receivedThisMonth: number;
  monthlyTarget: number;
};

export type ExtraPaycheckSuggestion = {
  id: string;
  label: string;
  icon: string;
  description: string;
};

export type SaveIncomePlanInput = {
  paySchedule: IncomePlanSchedule;
  paycheckAmount: number;
  anchorDate: string;
  weeklyDayOfWeek: number | null;
  monthlyDays: number[];
  customIntervalDays: number | null;
  depositAccountId: string | null;
  allocations: Omit<IncomePlanAllocation, "id">[];
};

export type MarkPaycheckReceivedInput = {
  customAllocations?: Record<string, number>;
  isExtraPaycheck?: boolean;
};

export const INCOME_PLAN_SCHEDULE_LABELS: Record<IncomePlanSchedule, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  twice_monthly: "Twice a month",
  monthly: "Monthly",
  custom: "Custom schedule",
};

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const EXTRA_PAYCHECK_SUGGESTIONS: ExtraPaycheckSuggestion[] = [
  {
    id: "debt",
    label: "Pay down debt",
    icon: "💳",
    description: "Send extra to your highest-interest balance.",
  },
  {
    id: "emergency",
    label: "Emergency fund",
    icon: "🛡️",
    description: "Boost your safety net with this bonus paycheck.",
  },
  {
    id: "investing",
    label: "Investing",
    icon: "📈",
    description: "Put the third paycheck toward long-term growth.",
  },
  {
    id: "vacation",
    label: "Vacation fund",
    icon: "✈️",
    description: "Treat this as a head start on your next trip.",
  },
];
