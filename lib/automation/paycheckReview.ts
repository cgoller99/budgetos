import { resolveAllocations } from "@/lib/allocation/allocationEngine";
import { INCOME_PLAN_SOURCE_ID, isIncomeSourceActive } from "@/lib/finance/effectiveIncome";
import {
  filterPersonalIncomePlan,
  filterPersonalIncomeSources,
} from "@/lib/finance/personalIncomeScope";
import type { FinanceData, IncomeSource, Transaction } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/finance/format";
import { formatPayDate } from "@/lib/incomePlan/payDates";
import { INCOME_PLAN_SCHEDULE_LABELS } from "@/lib/incomePlan/types";
import type { IncomePlan } from "@/lib/incomePlan/types";
import { cleanMerchantName } from "@/lib/plaid/transactionIntelligence";
import { getIncomeFrequencyLabel } from "@/lib/recurring/frequencies";
import { filterRealIncomeTransactions } from "@/lib/transactions/transferDetection";

const LOOKBACK_DAYS = 14;
const ALREADY_APPLIED_DAYS = 3;
const AMOUNT_TOLERANCE_RATIO = 0.05;
const AMOUNT_TOLERANCE_DOLLARS = 1;

const PAYROLL_LABEL =
  /\b(payroll|direct dep|dir dep|paycheck|salary|wages|employer)\b/i;
const NON_PAYCHECK_LABEL =
  /\b(venmo|zelle|cash app|paypal|refund|reversal|reimbursement|irs|tax refund)\b/i;

export type PaycheckReviewConfidence = "likely" | "needs_confirmation";

export type PaycheckReviewAllocation = {
  id: string;
  name: string;
  amount: number;
};

export type PaycheckReviewItem = {
  transactionId: string;
  merchant: string;
  actualAmount: number;
  expectedAmount: number;
  planAmount: number | null;
  frequencyLabel: string;
  expectedPayDate: string | null;
  matchedSourceName: string | null;
  confidence: PaycheckReviewConfidence;
  allocations: PaycheckReviewAllocation[];
  canApply: boolean;
};

export function paycheckReviewSuggestionId(transactionId: string): string {
  return `automation-paycheck-${transactionId}`;
}

function amountsClose(actual: number, expected: number): boolean {
  if (actual <= 0 || expected <= 0) {
    return false;
  }

  const delta = Math.abs(actual - expected);
  return delta <= AMOUNT_TOLERANCE_DOLLARS || delta / expected <= AMOUNT_TOLERANCE_RATIO;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceNameMatches(label: string, sourceName: string): boolean {
  const merchant = normalizeLabel(label);
  const source = normalizeLabel(sourceName);

  if (source.length < 4 || merchant.length === 0) {
    return false;
  }

  if (merchant.includes(source) || source.includes(merchant)) {
    return true;
  }

  const tokens = source.split(" ").filter((token) => token.length >= 4);
  return tokens.some((token) => merchant.includes(token));
}

function daysBetween(left: string, right: string): number {
  const start = Date.parse(`${left.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${right.slice(0, 10)}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(start - end) / 86_400_000;
}

function transactionLabel(transaction: Transaction): string {
  return `${transaction.notes ?? ""} ${transaction.category ?? ""}`.trim();
}

function confirmedSources(data: FinanceData): IncomeSource[] {
  return filterPersonalIncomeSources(data.income ?? [], data.viewerUserId).filter(
    (source) =>
      source.id !== INCOME_PLAN_SOURCE_ID && isIncomeSourceActive(source),
  );
}

function bestSourceMatch(
  label: string,
  amount: number,
  sources: IncomeSource[],
): IncomeSource | null {
  const matches = sources.filter(
    (source) =>
      sourceNameMatches(label, source.name) && amountsClose(amount, source.amount),
  );

  matches.sort(
    (left, right) =>
      Math.abs(left.amount - amount) - Math.abs(right.amount - amount),
  );

  return matches[0] ?? null;
}

function depositAlreadyApplied(
  data: FinanceData,
  transaction: Transaction,
): boolean {
  const events = data.incomePlanPaychecks ?? [];

  if (events.some((event) => event.incomeTransactionId === transaction.id)) {
    return true;
  }

  if (transaction.notes?.includes("Income Plan paycheck received")) {
    return true;
  }

  return events.some(
    (event) => daysBetween(event.payDate, transaction.date) <= ALREADY_APPLIED_DAYS,
  );
}

function preparedAllocations(plan: IncomePlan | null): PaycheckReviewAllocation[] {
  if (!plan?.isActive) {
    return [];
  }

  return resolveAllocations(plan).map(({ allocation, amount }) => ({
    id: allocation.id,
    name: allocation.name,
    amount,
  }));
}

function describeReview(item: PaycheckReviewItem): string {
  const payday = item.expectedPayDate
    ? ` Expected ${formatPayDate(item.expectedPayDate)}.`
    : "";
  const source = item.matchedSourceName
    ? ` Matches ${item.matchedSourceName}.`
    : "";
  const planDifference =
    item.planAmount !== null &&
    Math.abs(item.planAmount - item.actualAmount) > AMOUNT_TOLERANCE_DOLLARS
      ? ` Your plan is ${formatCurrency(item.planAmount)}.`
      : "";

  return `${item.merchant} deposited ${formatCurrency(item.actualAmount)}.${source}${planDifference}${payday} ${item.frequencyLabel}. Allocations stay put until you confirm.`;
}

export function buildPaycheckReviews(
  data: FinanceData,
  referenceDate = new Date(),
): PaycheckReviewItem[] {
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId);
  const activePlan = plan?.isActive && plan.paycheckAmount > 0 ? plan : null;
  const sources = confirmedSources(data);
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const deposits = filterRealIncomeTransactions(
    data,
    (data.transactions ?? []).filter(
      (transaction) =>
        transaction.type === "income" &&
        transaction.amount > 0 &&
        transaction.date >= cutoffDate,
    ),
  );

  const reviews: PaycheckReviewItem[] = [];

  for (const transaction of deposits) {
    if (depositAlreadyApplied(data, transaction)) {
      continue;
    }

    const label = transactionLabel(transaction);
    const source = bestSourceMatch(label, transaction.amount, sources);
    const planAmountMatch = Boolean(
      activePlan && amountsClose(transaction.amount, activePlan.paycheckAmount),
    );

    if (!source && !planAmountMatch) {
      continue;
    }

    if (!source && NON_PAYCHECK_LABEL.test(label)) {
      continue;
    }

    const accountMatches = Boolean(
      activePlan?.depositAccountId &&
        transaction.accountId === activePlan.depositAccountId,
    );
    const payrollLike = PAYROLL_LABEL.test(label);
    const confidence: PaycheckReviewConfidence =
      source || payrollLike || accountMatches ? "likely" : "needs_confirmation";
    const allocations = preparedAllocations(activePlan);
    const expectedAmount = source?.amount ?? activePlan?.paycheckAmount ?? transaction.amount;
    const frequencyLabel = activePlan
      ? INCOME_PLAN_SCHEDULE_LABELS[activePlan.paySchedule]
      : source
        ? getIncomeFrequencyLabel(source.frequency)
        : "Recurring";

    reviews.push({
      transactionId: transaction.id,
      merchant: cleanMerchantName(transaction.notes || transaction.category),
      actualAmount: transaction.amount,
      expectedAmount,
      planAmount: activePlan?.paycheckAmount ?? null,
      frequencyLabel,
      expectedPayDate: activePlan?.nextPayDate ?? source?.schedule?.nextOccurrence ?? null,
      matchedSourceName: source?.name ?? null,
      confidence,
      allocations,
      canApply: Boolean(activePlan),
    });
  }

  const dateById = new Map(deposits.map((transaction) => [transaction.id, transaction.date]));

  return reviews.sort((left, right) =>
    (dateById.get(right.transactionId) ?? "").localeCompare(
      dateById.get(left.transactionId) ?? "",
    ),
  );
}

export function paycheckReviewDescription(item: PaycheckReviewItem): string {
  return describeReview(item);
}

/** A detected deposit should be reviewed before the scheduled plan run applies it. */
export function shouldDeferScheduledPaycheck(
  data: FinanceData,
  referenceDate = new Date(),
): boolean {
  return buildPaycheckReviews(data, referenceDate).some((item) => item.canApply);
}
