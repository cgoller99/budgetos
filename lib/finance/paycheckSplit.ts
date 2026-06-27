import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { enrichBill, getBillProgressList } from "@/lib/finance/bills";
import type {
  BillProgress,
  FinanceData,
  PaycheckAssignment,
  PaycheckPeriodSummary,
  PaycheckSplitSummary,
} from "@/lib/finance/types";
import { normalizeRecurringFinanceData } from "@/lib/recurring/normalize";

export const PAYCHECK_ASSIGNMENT_LABELS: Record<PaycheckAssignment, string> = {
  first_paycheck: "1st Paycheck",
  second_paycheck: "2nd Paycheck",
  weekly: "Weekly Paycheck",
  biweekly: "Biweekly Paycheck",
  custom: "Custom Pay Date",
};

export const PAYCHECK_ASSIGNMENT_OPTIONS: {
  value: PaycheckAssignment;
  label: string;
}[] = Object.entries(PAYCHECK_ASSIGNMENT_LABELS).map(([value, label]) => ({
  value: value as PaycheckAssignment,
  label,
}));

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function normalizeAssignment(value?: string | null): PaycheckAssignment {
  if (value && value in PAYCHECK_ASSIGNMENT_LABELS) {
    return value as PaycheckAssignment;
  }

  return "first_paycheck";
}

function incomeForAssignment(
  data: FinanceData,
  assignment: PaycheckAssignment,
): number {
  const normalized = normalizeRecurringFinanceData(data);
  const activeIncome = (normalized.income ?? []).filter(
    (source) => source.schedule?.status !== "paused",
  );

  if (activeIncome.length === 0) {
    return 0;
  }

  switch (assignment) {
    case "first_paycheck":
    case "second_paycheck":
      return sum(
        activeIncome
          .filter((source) => {
            const frequency = source.frequency;
            return (
              frequency === "twice_monthly" ||
              frequency === "monthly" ||
              frequency === "yearly"
            );
          })
          .map((source) => toMonthlyAmount(source.amount, source.frequency) / 2),
      );
    case "weekly":
      return sum(
        activeIncome
          .filter((source) => source.frequency === "weekly")
          .map((source) => source.amount),
      );
    case "biweekly":
      return sum(
        activeIncome
          .filter(
            (source) =>
              source.frequency === "biweekly" ||
              source.frequency === "every_2_weeks",
          )
          .map((source) => source.amount),
      );
    case "custom":
      return sum(activeIncome.map((source) => toMonthlyAmount(source.amount, source.frequency)));
    default:
      return 0;
  }
}

function billsForAssignment(
  bills: BillProgress[],
  assignment: PaycheckAssignment,
): BillProgress[] {
  return bills.filter(
    (bill) => normalizeAssignment(bill.paycheckAssignment) === assignment,
  );
}

function buildPeriod(
  data: FinanceData,
  assignment: PaycheckAssignment,
  bills: BillProgress[],
  upcomingPeriodId: PaycheckAssignment | null,
): PaycheckPeriodSummary {
  const assignedBills = billsForAssignment(bills, assignment);
  const income = incomeForAssignment(data, assignment);
  const billsTotal = sum(assignedBills.map((bill) => bill.amount));

  return {
    id: assignment,
    label: PAYCHECK_ASSIGNMENT_LABELS[assignment],
    income,
    billsTotal,
    remaining: income - billsTotal,
    bills: assignedBills,
    isUpcoming: upcomingPeriodId === assignment,
  };
}

function detectUpcomingPeriod(
  data: FinanceData,
  referenceDate: Date,
): PaycheckAssignment | null {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  const primary = normalized.income[0];

  if (!primary) {
    return "first_paycheck";
  }

  switch (primary.frequency) {
    case "weekly":
      return "weekly";
    case "biweekly":
    case "every_2_weeks":
      return "biweekly";
    case "twice_monthly": {
      const day = referenceDate.getDate();
      return day < 15 ? "first_paycheck" : "second_paycheck";
    }
    default:
      return "first_paycheck";
  }
}

export function getPaycheckSplitSummary(
  data: FinanceData,
  referenceDate = new Date(),
): PaycheckSplitSummary {
  const billProgress = getBillProgressList(data, referenceDate);
  const upcomingPeriodId = detectUpcomingPeriod(data, referenceDate);
  const assignments: PaycheckAssignment[] = [
    "first_paycheck",
    "second_paycheck",
    "weekly",
    "biweekly",
    "custom",
  ];

  const periods = assignments.map((assignment) =>
    buildPeriod(data, assignment, billProgress, upcomingPeriodId),
  );

  return {
    periods,
    upcomingPeriodId,
    totalIncome: sum(periods.map((period) => period.income)),
    totalBills: sum(periods.map((period) => period.billsTotal)),
    totalRemaining: sum(periods.map((period) => period.remaining)),
  };
}

export { normalizeAssignment as normalizePaycheckAssignment };
