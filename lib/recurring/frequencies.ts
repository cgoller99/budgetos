import type {
  BillFrequency,
  ContributionFrequency,
  IncomeFrequency,
} from "@/lib/recurring/types";

export const INCOME_FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  every_2_weeks: "Biweekly",
  twice_monthly: "Twice Monthly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const INCOME_FREQUENCY_OPTIONS: {
  value: IncomeFrequency;
  label: string;
}[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "twice_monthly", label: "Twice Monthly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const CONTRIBUTION_FREQUENCY_LABELS: Record<
  ContributionFrequency,
  string
> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
};

export function normalizeIncomeFrequency(frequency: string): IncomeFrequency {
  if (frequency === "biweekly") {
    return "every_2_weeks";
  }

  if (frequency in INCOME_FREQUENCY_LABELS) {
    return frequency as IncomeFrequency;
  }

  return "monthly";
}

export function getIncomeFrequencyLabel(frequency: string): string {
  return (
    INCOME_FREQUENCY_LABELS[normalizeIncomeFrequency(frequency)] ?? "Recurring"
  );
}

export function getBillFrequencyLabel(frequency: string): string {
  return (
    BILL_FREQUENCY_LABELS[frequency as BillFrequency] ?? "Monthly"
  );
}

export function getContributionFrequencyLabel(frequency: string): string {
  return (
    CONTRIBUTION_FREQUENCY_LABELS[frequency as ContributionFrequency] ??
    "Recurring"
  );
}
