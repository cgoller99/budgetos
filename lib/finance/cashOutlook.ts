import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import { EXTRA_DEBT_ALLOCATION_NAME } from "@/lib/finance/debtPayoff";
import { advancePayDate, formatPayDate, resolveUpcomingPayDate } from "@/lib/incomePlan/payDates";
import { calculateAvailableCash } from "@/lib/calculations/availableCash";
import { getBillProgressList, getCurrentYearMonth } from "@/lib/finance/bills";
import {
  getEffectiveIncomeSources,
  isIncomePlanSourceId,
  isIncomeSourceActive,
} from "@/lib/finance/effectiveIncome";
import { formatCurrency } from "@/lib/finance/format";
import {
  filterPersonalIncomePlan,
  isPersonalOwnerRow,
} from "@/lib/finance/personalIncomeScope";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { detectRecurringBillCandidatesFromFinanceData } from "@/lib/plaid/recurringBillDetection";
import {
  advanceOccurrence,
  computeInitialNextOccurrence,
  parseDateString,
  startOfDay,
  toDateString,
} from "@/lib/recurring/schedule";
import {
  getDisplayCategory,
  isTransferDisplayCategory,
} from "@/lib/transactions/categoryPresentation";

const HORIZON_DAYS = 30;

export type CashOutlookKind = "paycheck" | "bill" | "recurring" | "goal" | "debt";

export type CashOutlookEvent = {
  id: string;
  date: string;
  name: string;
  amount: number;
  kind: CashOutlookKind;
  confidence: "estimated";
  detail: string;
  balanceAfter: number;
};

export type CashOutlookShortfall = {
  date: string;
  amount: number;
  detail: string;
};

export type CashOutlook = {
  horizonDays: number;
  startDate: string;
  endDate: string;
  availableCash: number;
  availableCashConfidence: "confirmed";
  events: CashOutlookEvent[];
  endingCash: number;
  lowBalance: { date: string; amount: number };
  shortfalls: CashOutlookShortfall[];
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(left: string, right: string): boolean {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
}

function monthStarts(today: Date, horizon: Date): Date[] {
  const starts: Date[] = [];
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor.getTime() <= horizon.getTime()) {
    starts.push(cursor);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return starts;
}

function upcomingDates(
  first: Date,
  nextDate: (current: Date) => Date,
  today: Date,
  horizon: Date,
): Date[] {
  const dates: Date[] = [];
  let cursor = startOfDay(first);
  let guard = 0;

  while (cursor.getTime() < today.getTime() && guard < 24) {
    const next = startOfDay(nextDate(cursor));
    if (next.getTime() <= cursor.getTime()) {
      break;
    }
    cursor = next;
    guard += 1;
  }

  while (cursor.getTime() <= horizon.getTime() && guard < 36) {
    if (cursor.getTime() >= today.getTime()) {
      dates.push(cursor);
    }
    const next = startOfDay(nextDate(cursor));
    if (next.getTime() <= cursor.getTime()) {
      break;
    }
    cursor = next;
    guard += 1;
  }

  return dates;
}

function debtPaidInMonth(
  data: FinanceData,
  debtId: string,
  debtName: string,
  minimumPayment: number,
  month: string,
): boolean {
  const paid = (data.transactions ?? [])
    .filter((transaction) => {
      if (
        transaction.type !== "expense" ||
        transaction.amount <= 0 ||
        !transaction.date.startsWith(month) ||
        !isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId)
      ) {
        return false;
      }
      if (transaction.debtId === debtId) {
        return true;
      }
      return namesMatch(transaction.notes || transaction.category, debtName);
    })
    .reduce((total, transaction) => total + transaction.amount, 0);

  return paid >= minimumPayment * 0.5 && paid > 0;
}

function recurringOwnedBySomeoneElse(
  data: FinanceData,
  transactionIds: string[],
): boolean {
  if (!data.viewerUserId || transactionIds.length === 0) {
    return false;
  }
  const rows = transactionIds
    .map((id) => data.transactions.find((transaction) => transaction.id === id))
    .filter((transaction): transaction is Transaction => Boolean(transaction));
  if (rows.length === 0) {
    return false;
  }
  return rows.every(
    (transaction) => !isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId),
  );
}

/**
 * 30-day cash outlook.
 * Opening cash is the confirmed available balance. Later rows are estimates.
 * Posted transfers, paid bills, and payments already in the balance are not
 * subtracted again. A goal is counted from its active schedule or from an
 * Income Plan allocation, not both. A debt minimum is skipped when a bill
 * with the same name is already in the outlook.
 */
export function forecastCashOutlook(
  data: FinanceData,
  referenceDate = new Date(),
): CashOutlook {
  const today = startOfDay(referenceDate);
  const horizon = addDays(today, HORIZON_DAYS);
  const events: Array<Omit<CashOutlookEvent, "balanceAfter">> = [];
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);

  for (const source of getEffectiveIncomeSources(data)) {
    if (!isIncomeSourceActive(source) || source.amount <= 0 || !source.schedule) {
      continue;
    }
    const usePlanDates = Boolean(isIncomePlanSourceId(source.id) && plan?.isActive);
    const storedFirst = parseDateString(
      (usePlanDates && plan ? plan.nextPayDate : source.schedule.nextOccurrence).slice(0, 10),
    );
    const first =
      usePlanDates && plan
        ? parseDateString(resolveUpcomingPayDate(plan, referenceDate))
        : computeInitialNextOccurrence(
            storedFirst,
            source.schedule.frequency ?? source.frequency,
            referenceDate,
          );
    const dates = upcomingDates(
      first,
      (current) => {
        if (usePlanDates && plan) {
          return parseDateString(
            advancePayDate({ ...plan, nextPayDate: toDateString(current) }),
          );
        }
        return advanceOccurrence(current, source.schedule?.frequency ?? source.frequency);
      },
      today,
      horizon,
    );

    for (const date of dates) {
      const key = toDateString(date);
      if (
        source.schedule.lastProcessedDate &&
        source.schedule.lastProcessedDate.slice(0, 10) >= key
      ) {
        continue;
      }
      events.push({
        id: `paycheck-${source.id}-${key}`,
        date: key,
        name: source.name,
        amount: roundCurrency(source.amount),
        kind: "paycheck",
        confidence: "estimated",
        detail: `Expected ${source.name} of ${formatCurrency(source.amount)} on ${key} from the income schedule. This is not a posted deposit.`,
      });
    }
  }

  const billNames: string[] = [];
  for (const monthStart of monthStarts(today, horizon)) {
    const monthReference =
      getCurrentYearMonth(monthStart) === getCurrentYearMonth(today) ? today : monthStart;
    const currentMonth = monthReference === today;

    for (const progress of getBillProgressList(data, monthReference)) {
      const bill = data.bills.find((item) => item.id === progress.billId);
      if (!bill || bill.schedule?.status === "paused") {
        continue;
      }
      if (!currentMonth && bill.recurring === false) {
        continue;
      }
      if (progress.status === "paid" || progress.remainingAmount <= 0 || !progress.dueDate) {
        continue;
      }
      const due = startOfDay(progress.dueDate);
      if (!currentMonth && due.getTime() < today.getTime()) {
        continue;
      }
      const when = due.getTime() < today.getTime() ? today : due;
      if (when.getTime() > horizon.getTime()) {
        continue;
      }
      const key = toDateString(when);
      billNames.push(progress.name);
      events.push({
        id: `bill-${progress.splitId}-${getCurrentYearMonth(monthReference)}`,
        date: key,
        name: progress.name,
        amount: roundCurrency(-progress.remainingAmount),
        kind: "bill",
        confidence: "estimated",
        detail: `${progress.name} still has ${formatCurrency(progress.remainingAmount)} unpaid for ${getCurrentYearMonth(monthReference)}. The outlook uses that bill amount until a payment posts.`,
      });
    }
  }

  const debtIds = new Set<string>();
  for (const debt of data.debts ?? []) {
    if (debt.balance <= 0 || debt.minimumPayment <= 0 || debt.dueDay <= 0) {
      continue;
    }
    if (billNames.some((name) => namesMatch(name, debt.name))) {
      continue;
    }
    for (const monthStart of monthStarts(today, horizon)) {
      const month = getCurrentYearMonth(monthStart);
      const due = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        Math.min(debt.dueDay, new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()),
      );
      const currentMonth = month === getCurrentYearMonth(today);
      if (debtPaidInMonth(data, debt.id, debt.name, debt.minimumPayment, month)) {
        continue;
      }
      const when = due.getTime() < today.getTime() ? (currentMonth ? today : null) : due;
      if (!when || when.getTime() > horizon.getTime()) {
        continue;
      }
      const key = toDateString(when);
      debtIds.add(debt.id);
      events.push({
        id: `debt-${debt.id}-${month}`,
        date: key,
        name: debt.name,
        amount: roundCurrency(-debt.minimumPayment),
        kind: "debt",
        confidence: "estimated",
        detail: `${debt.name} minimum of ${formatCurrency(debt.minimumPayment)} is scheduled for ${key}. It is left out when a bill with the same name, or a posted payment this month, already covers it.`,
      });
    }
  }

  const scheduledGoalIds = new Set<string>();
  for (const goal of data.savingsGoals ?? []) {
    const contribution = goal.autoContribution;
    if (
      !contribution ||
      contribution.schedule.status !== "active" ||
      contribution.amount <= 0 ||
      goal.current >= goal.target
    ) {
      continue;
    }
    let cursor = parseDateString(contribution.schedule.nextOccurrence.slice(0, 10));
    if (contribution.schedule.lastProcessedDate) {
      const processed = contribution.schedule.lastProcessedDate.slice(0, 10);
      while (toDateString(cursor) <= processed) {
        cursor = advanceOccurrence(cursor, contribution.frequency);
      }
    }
    if (cursor.getTime() < today.getTime()) {
      scheduledGoalIds.add(goal.id);
      events.push({
        id: `goal-${goal.id}-overdue-${toDateString(today)}`,
        date: toDateString(today),
        name: goal.name,
        amount: roundCurrency(-contribution.amount),
        kind: "goal",
        confidence: "estimated",
        detail: `${goal.name} has a ${formatCurrency(contribution.amount)} contribution that was scheduled before today and is still active. Later dates in the 30 days are listed separately.`,
      });
      while (cursor.getTime() < today.getTime()) {
        cursor = advanceOccurrence(cursor, contribution.frequency);
      }
    }
    let guard = 0;
    while (cursor.getTime() <= horizon.getTime() && guard < 12) {
      const key = toDateString(cursor);
      scheduledGoalIds.add(goal.id);
      events.push({
        id: `goal-${goal.id}-${key}`,
        date: key,
        name: goal.name,
        amount: roundCurrency(-contribution.amount),
        kind: "goal",
        confidence: "estimated",
        detail: `${goal.name} has an active ${contribution.frequency} contribution of ${formatCurrency(contribution.amount)} on ${key}. Saving this does not move money by itself.`,
      });
      cursor = advanceOccurrence(cursor, contribution.frequency);
      guard += 1;
    }
  }

  if (plan?.isActive) {
    const payDates = upcomingDates(
      parseDateString(resolveUpcomingPayDate(plan, referenceDate)),
      (current) =>
        parseDateString(advancePayDate({ ...plan, nextPayDate: toDateString(current) })),
      today,
      horizon,
    );
    const resolved = resolveAllocationAmounts(plan);
    for (const date of payDates) {
      const key = toDateString(date);
      for (const item of resolved) {
        const allocation = item.allocation;
        if (item.amount <= 0 || allocation.isRemainingBalance || allocation.billId) {
          continue;
        }
        if (allocation.goalId) {
          if (scheduledGoalIds.has(allocation.goalId)) {
            continue;
          }
          events.push({
            id: `goal-plan-${allocation.id}-${key}`,
            date: key,
            name: allocation.name,
            amount: roundCurrency(-item.amount),
            kind: "goal",
            confidence: "estimated",
            detail: `${allocation.name} takes ${formatCurrency(item.amount)} from the ${key} paycheck. The goal has no separate active schedule, so it is counted here once.`,
          });
        }
        if (allocation.debtId) {
          const countedMinimum = debtIds.has(allocation.debtId);
          // debtId is the source of truth for which debt is linked. When the
          // calendar already includes that debt's minimum, only planner extras
          // (tagged by EXTRA_DEBT_ALLOCATION_NAME) add an additional outflow.
          const taggedExtra = allocation.name === EXTRA_DEBT_ALLOCATION_NAME;
          if (countedMinimum && !taggedExtra) {
            continue;
          }
          events.push({
            id: `debt-plan-${allocation.id}-${key}`,
            date: key,
            name: allocation.name,
            amount: roundCurrency(-item.amount),
            kind: "debt",
            confidence: "estimated",
            detail: taggedExtra
              ? `${allocation.name} adds ${formatCurrency(item.amount)} from the ${key} paycheck for debt ${allocation.debtId}. The scheduled minimum is counted separately.`
              : `${allocation.name} takes ${formatCurrency(item.amount)} from the ${key} paycheck via debt link ${allocation.debtId}.`,
          });
        }
      }
    }
  }

  const candidates = detectRecurringBillCandidatesFromFinanceData(
    data,
    data.plaidRecurringDismissals ?? [],
  );
  for (const candidate of candidates) {
    if (candidate.action !== "create" || candidate.existingBillId || !candidate.lastPaymentDate) {
      continue;
    }
    if (
      isTransferDisplayCategory(candidate.category) ||
      getDisplayCategory(candidate.category) === "Transfers"
    ) {
      continue;
    }
    if (recurringOwnedBySomeoneElse(data, candidate.internalTransactionIds)) {
      continue;
    }
    const linked = candidate.internalTransactionIds
      .map((id) => data.transactions.find((transaction) => transaction.id === id))
      .filter((transaction): transaction is Transaction => Boolean(transaction));
    if (
      linked.some(
        (transaction) =>
          transaction.type === "transfer" ||
          isTransferDisplayCategory(transaction.category) ||
          Boolean(transaction.goalId) ||
          Boolean(transaction.debtId) ||
          Boolean(transaction.billId),
      )
    ) {
      continue;
    }
    if (
      (data.debts ?? []).some((debt) =>
        namesMatch(debt.name, candidate.displayName) || namesMatch(debt.name, candidate.merchantKey),
      ) ||
      billNames.some(
        (name) =>
          namesMatch(name, candidate.displayName) || namesMatch(name, candidate.merchantKey),
      )
    ) {
      continue;
    }
    let cursor = advanceOccurrence(
      parseDateString(candidate.lastPaymentDate.slice(0, 10)),
      candidate.frequency,
    );
    let guard = 0;
    while (cursor.getTime() <= horizon.getTime() && guard < 12) {
      if (cursor.getTime() >= today.getTime()) {
        const key = toDateString(cursor);
        events.push({
          id: `recurring-${candidate.merchantKey}-${key}`,
          date: key,
          name: candidate.displayName,
          amount: roundCurrency(-candidate.averageAmount),
          kind: "recurring",
          confidence: "estimated",
          detail: `${candidate.displayName} looks recurring at about ${formatCurrency(candidate.averageAmount)} ${candidate.frequency}, with the last posted charge on ${candidate.lastPaymentDate.slice(0, 10)}. It is not a saved bill, so this date is an estimate.`,
        });
      }
      const next = advanceOccurrence(cursor, candidate.frequency);
      if (next.getTime() <= cursor.getTime()) {
        break;
      }
      cursor = next;
      guard += 1;
    }
  }

  events.sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }
    if (left.amount !== right.amount) {
      return right.amount - left.amount;
    }
    return left.name.localeCompare(right.name);
  });

  let balance = roundCurrency(calculateAvailableCash(data));
  const availableCash = balance;
  let lowBalance = { date: toDateString(today), amount: balance };
  const shortfalls: CashOutlookShortfall[] = [];
  const projected: CashOutlookEvent[] = [];
  const byDate = new Map<string, Array<Omit<CashOutlookEvent, "balanceAfter">>>();
  for (const event of events) {
    const group = byDate.get(event.date) ?? [];
    group.push(event);
    byDate.set(event.date, group);
  }

  for (const [date, group] of [...byDate.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    const ordered = [...group].sort((left, right) => right.amount - left.amount);
    for (const event of ordered) {
      balance = roundCurrency(balance + event.amount);
      projected.push({ ...event, balanceAfter: balance });
      if (balance < lowBalance.amount) {
        lowBalance = { date, amount: balance };
      }
    }
    if (balance < 0) {
      const outflows = ordered
        .filter((event) => event.amount < 0)
        .map((event) => event.name)
        .join(", ");
      shortfalls.push({
        date,
        amount: balance,
        detail: `After estimated activity on ${date}, cash would be ${formatCurrency(balance)}. Outflows that day: ${outflows || "none"}. Opening cash is confirmed; these later amounts are estimates. Same-day deposits are applied before withdrawals.`,
      });
    }
  }

  return {
    horizonDays: HORIZON_DAYS,
    startDate: toDateString(today),
    endDate: toDateString(horizon),
    availableCash,
    availableCashConfidence: "confirmed",
    events: projected,
    endingCash: balance,
    lowBalance,
    shortfalls,
  };
}

export function describeCashOutlook(outlook: CashOutlook): string | null {
  if (outlook.shortfalls[0]) {
    const extra = outlook.shortfalls.length - 1;
    const more =
      extra > 0 ? ` and ${extra} other day${extra === 1 ? "" : "s"}` : "";
    return `Possible shortfall of ${formatCurrency(Math.abs(outlook.shortfalls[0].amount))} on ${formatPayDate(outlook.shortfalls[0].date)}${more}. Opening cash is confirmed. Later amounts are estimates.`;
  }

  if (outlook.lowBalance.amount < outlook.availableCash) {
    return `30-day low of ${formatCurrency(outlook.lowBalance.amount)} on ${formatPayDate(outlook.lowBalance.date)}. Opening cash is confirmed. Later amounts are estimates.`;
  }

  return null;
}
