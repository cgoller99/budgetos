import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { calculateMonthlyIncome, calculateMonthlySpending } from "@/lib/calculations/cashFlow";
import type {
  Bill,
  BillProgress,
  BillsDashboardSummary,
  BillStatus,
  FinanceData,
} from "@/lib/finance/types";

const DUE_SOON_DAYS = 3;

export const CALENDAR_STATUS_LABELS: Record<BillStatus, string> = {
  upcoming: "Upcoming",
  due_soon: "Due Soon",
  due_today: "Due Today",
  overdue: "Overdue",
  paid: "Paid",
};

const STATUS_LABELS = CALENDAR_STATUS_LABELS;

const MS_PER_DAY = 86_400_000;

export function getCurrentYearMonth(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDueDateForMonth(
  dueDay: number,
  referenceDate: Date,
): Date | null {
  if (dueDay <= 0) {
    return null;
  }

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);

  return new Date(year, month, day);
}

export function getBillStatus(
  bill: Bill,
  referenceDate = new Date(),
): BillStatus {
  const currentMonth = getCurrentYearMonth(referenceDate);

  if (bill.paidMonth === currentMonth) {
    return "paid";
  }

  if (bill.dueDay <= 0) {
    return "upcoming";
  }

  const dueDate = getDueDateForMonth(bill.dueDay, referenceDate);

  if (!dueDate) {
    return "upcoming";
  }

  const today = startOfDay(referenceDate);
  const due = startOfDay(dueDate);

  if (today.getTime() === due.getTime()) {
    return "due_today";
  }

  if (today > due) {
    return "overdue";
  }

  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysUntilDue <= DUE_SOON_DAYS) {
    return "due_soon";
  }

  return "upcoming";
}

export function formatBillDueDate(
  dueDate: Date | null,
  dueDay: number,
): string {
  if (dueDay <= 0) {
    return "Flexible";
  }

  if (!dueDate) {
    return "—";
  }

  return dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function enrichBill(
  bill: Bill,
  referenceDate = new Date(),
): BillProgress {
  const dueDate = getDueDateForMonth(bill.dueDay, referenceDate);
  const status = getBillStatus(bill, referenceDate);

  return {
    id: bill.id,
    name: bill.name,
    category: bill.category,
    amount: bill.amount,
    dueDay: bill.dueDay,
    dueDate,
    formattedDueDate: formatBillDueDate(dueDate, bill.dueDay),
    autopay: bill.autopay,
    recurring: bill.recurring,
    status,
    statusLabel: STATUS_LABELS[status],
    paycheckAssignment: bill.paycheckAssignment ?? "first_paycheck",
  };
}

export function getBillProgressList(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return (data.bills ?? []).map((bill) => enrichBill(bill, referenceDate));
}

export function getMonthlyBills(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate).filter((bill) => bill.recurring);
}

export function getUpcomingBills(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate)
    .filter((bill) => bill.status !== "paid")
    .sort((left, right) => {
      const statusOrder: Record<BillStatus, number> = {
        overdue: 0,
        due_today: 1,
        due_soon: 2,
        upcoming: 3,
        paid: 4,
      };

      if (statusOrder[left.status] !== statusOrder[right.status]) {
        return statusOrder[left.status] - statusOrder[right.status];
      }

      if (!left.dueDate && !right.dueDate) {
        return left.name.localeCompare(right.name);
      }

      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;

      return left.dueDate.getTime() - right.dueDate.getTime();
    });
}

export function getPaidBills(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate)
    .filter((bill) => bill.status === "paid")
    .sort((left, right) => left.name.localeCompare(right.name));
}

function daysUntil(date: Date, referenceDate: Date): number {
  const today = startOfDay(referenceDate);
  const target = startOfDay(date);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function getBillsDueThisWeek(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate).filter((bill) => {
    if (bill.status === "paid" || !bill.dueDate) {
      return false;
    }

    if (bill.status === "overdue" || bill.status === "due_today") {
      return true;
    }

    const days = daysUntil(bill.dueDate, referenceDate);
    return days >= 0 && days <= 7;
  });
}

export function getNextBillDue(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress | null {
  const candidates = getBillProgressList(data, referenceDate).filter(
    (bill) => bill.status !== "paid" && bill.dueDate,
  );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    if (left.status === "overdue" && right.status !== "overdue") {
      return -1;
    }

    if (right.status === "overdue" && left.status !== "overdue") {
      return 1;
    }

    if (left.status === "due_today" && right.status !== "due_today") {
      return -1;
    }

    if (right.status === "due_today" && left.status !== "due_today") {
      return 1;
    }

    if (!left.dueDate || !right.dueDate) {
      return 0;
    }

    return left.dueDate.getTime() - right.dueDate.getTime();
  })[0];
}

export function getTotalMonthlyBills(data: FinanceData): number {
  return (data.bills ?? [])
    .filter((bill) => bill.recurring)
    .reduce(
      (total, bill) =>
        total + toMonthlyAmount(bill.amount, bill.frequency ?? "monthly"),
      0,
    );
}

export function getBillsDashboardSummary(
  data: FinanceData,
  referenceDate = new Date(),
): BillsDashboardSummary {
  const dueThisWeek = getBillsDueThisWeek(data, referenceDate);
  const nextBill = getNextBillDue(data, referenceDate);
  const totalMonthlyBills = getTotalMonthlyBills(data);

  return {
    dueThisWeekCount: dueThisWeek.length,
    dueThisWeekAmount: dueThisWeek.reduce(
      (total, bill) => total + bill.amount,
      0,
    ),
    totalMonthlyBills,
    nextBill: nextBill
      ? {
          id: nextBill.id,
          name: nextBill.name,
          amount: nextBill.amount,
          dueDate: nextBill.formattedDueDate,
          daysUntilDue: nextBill.dueDate
            ? daysUntil(nextBill.dueDate, referenceDate)
            : 0,
          status: nextBill.status,
        }
      : null,
    monthlyCashRemaining:
      calculateMonthlyIncome(data, referenceDate) -
      calculateMonthlySpending(data, referenceDate),
  };
}

export function getBillStatusVariant(
  status: BillStatus,
): "default" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "paid":
      return "success";
    case "due_today":
      return "accent";
    case "due_soon":
      return "warning";
    case "overdue":
      return "danger";
    default:
      return "default";
  }
}
