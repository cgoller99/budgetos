import type { Bill, BillFrequency, FinanceData, Transaction } from "@/lib/finance/types";
import type { PlaidMappedTransaction, RecurringBillCandidate } from "@/lib/plaid/types";

const AMOUNT_VARIANCE = 0.15;
const DAY_OF_MONTH_TOLERANCE = 3;
const MIN_OCCURRENCES = 2;

const KNOWN_SUBSCRIPTION_MERCHANTS = [
  "netflix",
  "spotify",
  "hulu",
  "disney",
  "apple",
  "amazon prime",
  "youtube",
  "gym",
  "planet fitness",
  "peloton",
];

const KNOWN_UTILITY_MERCHANTS = [
  "georgia power",
  "electric",
  "water",
  "gas",
  "internet",
  "comcast",
  "xfinity",
  "att",
  "at&t",
  "verizon",
  "tmobile",
  "t-mobile",
];

function normalizeMerchantKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function displayMerchantName(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function amountsAreSimilar(amounts: number[]): boolean {
  if (amounts.length === 0) {
    return false;
  }

  const average = amounts.reduce((total, amount) => total + amount, 0) / amounts.length;

  if (average <= 0) {
    return false;
  }

  return amounts.every(
    (amount) => Math.abs(amount - average) / average <= AMOUNT_VARIANCE,
  );
}

function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function daysBetween(a: string, b: string): number {
  const first = parseDate(a).getTime();
  const second = parseDate(b).getTime();
  return Math.round(Math.abs(second - first) / (1000 * 60 * 60 * 24));
}

function inferFrequency(sortedDates: string[]): BillFrequency | null {
  if (sortedDates.length < MIN_OCCURRENCES) {
    return null;
  }

  const intervals: number[] = [];

  for (let index = 1; index < sortedDates.length; index += 1) {
    intervals.push(daysBetween(sortedDates[index - 1]!, sortedDates[index]!));
  }

  const averageInterval =
    intervals.reduce((total, value) => total + value, 0) / intervals.length;

  const intervalMatches = (target: number, tolerance: number) =>
    intervals.every((interval) => Math.abs(interval - target) <= tolerance);

  if (intervalMatches(7, 2) || (averageInterval >= 5 && averageInterval <= 9)) {
    return "weekly";
  }

  if (intervalMatches(14, 3) || (averageInterval >= 11 && averageInterval <= 18)) {
    return "biweekly";
  }

  if (intervalMatches(30, 5) || (averageInterval >= 25 && averageInterval <= 35)) {
    return "monthly";
  }

  if (intervalMatches(91, 10) || (averageInterval >= 80 && averageInterval <= 100)) {
    return "quarterly";
  }

  if (intervalMatches(365, 20) || averageInterval >= 330) {
    return "yearly";
  }

  const days = sortedDates.map((date) => parseDate(date).getDate());
  const averageDay = days.reduce((total, day) => total + day, 0) / days.length;
  const sameDayOfMonth = days.every((day) => Math.abs(day - averageDay) <= DAY_OF_MONTH_TOLERANCE);
  const distinctMonths = new Set(sortedDates.map((date) => date.slice(0, 7)));

  if (sameDayOfMonth && distinctMonths.size >= 2) {
    return "monthly";
  }

  return null;
}

function inferCategory(merchantKey: string, fallback: string): string {
  if (KNOWN_SUBSCRIPTION_MERCHANTS.some((merchant) => merchantKey.includes(merchant))) {
    return "Subscriptions";
  }

  if (KNOWN_UTILITY_MERCHANTS.some((merchant) => merchantKey.includes(merchant))) {
    return "Utilities";
  }

  if (
    merchantKey.includes("rent") ||
    merchantKey.includes("mortgage") ||
    merchantKey.includes("landlord")
  ) {
    return "Housing";
  }

  if (
    merchantKey.includes("insurance") ||
    merchantKey.includes("geico") ||
    merchantKey.includes("progressive")
  ) {
    return "Insurance";
  }

  if (
    merchantKey.includes("loan") ||
    merchantKey.includes("car payment") ||
    merchantKey.includes("auto finance")
  ) {
    return "Loans";
  }

  return fallback || "Bills";
}

function estimateDueDay(sortedDates: string[], frequency: BillFrequency): number {
  if (frequency === "weekly" || frequency === "biweekly") {
    const lastDate = parseDate(sortedDates[sortedDates.length - 1]!);
    return Math.min(28, Math.max(1, lastDate.getDate()));
  }

  const days = sortedDates.map((date) => parseDate(date).getDate());
  const averageDay = days.reduce((total, day) => total + day, 0) / days.length;
  return Math.min(28, Math.max(1, Math.round(averageDay)));
}

function estimateNextPaymentDate(
  lastDate: string,
  frequency: BillFrequency,
): string {
  const date = parseDate(lastDate);

  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().slice(0, 10);
}

function suggestAutopay(items: Array<{ amount: number }>): boolean {
  if (items.length < 2) {
    return false;
  }

  const amounts = items.map((item) => item.amount);
  const average = amounts.reduce((total, amount) => total + amount, 0) / amounts.length;
  const variance =
    amounts.reduce((total, amount) => total + Math.abs(amount - average), 0) /
    amounts.length;

  return variance / average <= 0.05;
}

export function findMatchingBill(
  bills: Bill[],
  merchantKey: string,
  displayName: string,
): Bill | null {
  const normalizedMerchant = normalizeMerchantKey(merchantKey);
  const normalizedDisplay = normalizeMerchantKey(displayName);

  return (
    bills.find((bill) => {
      const billName = normalizeMerchantKey(bill.name);
      return (
        billName === normalizedMerchant ||
        billName === normalizedDisplay ||
        billName.includes(normalizedMerchant) ||
        normalizedMerchant.includes(billName)
      );
    }) ?? null
  );
}

type DetectionItem = {
  externalTransactionId: string;
  internalTransactionId?: string;
  accountId?: string | null;
  amount: number;
  date: string;
  category: string;
  notes: string;
};

function toDetectionItemsFromPlaid(
  transactions: PlaidMappedTransaction[],
  financeData?: FinanceData,
): DetectionItem[] {
  return transactions
    .filter((transaction) => transaction.type === "expense")
    .map((transaction) => {
      const internal = financeData?.transactions.find(
        (item) => item.externalTransactionId === transaction.externalTransactionId,
      );

      return {
        externalTransactionId: transaction.externalTransactionId,
        internalTransactionId: internal?.id,
        accountId: internal?.accountId ?? null,
        amount: transaction.amount,
        date: transaction.date,
        category: transaction.category,
        notes: transaction.notes || transaction.name,
      };
    })
    .filter((item) => !financeData?.transactions.some(
      (transaction) =>
        transaction.externalTransactionId === item.externalTransactionId &&
        Boolean(transaction.billId),
    ));
}

function toDetectionItemsFromFinance(data: FinanceData): DetectionItem[] {
  return data.transactions
    .filter(
      (transaction) =>
        transaction.type === "expense" &&
        !transaction.billId &&
        transaction.amount > 0,
    )
    .map((transaction) => ({
      externalTransactionId: transaction.externalTransactionId ?? transaction.id,
      internalTransactionId: transaction.id,
      accountId: transaction.accountId,
      amount: transaction.amount,
      date: transaction.date,
      category: transaction.category,
      notes: transaction.notes ?? transaction.category,
    }));
}

function buildCandidateFromGroup(
  merchantKey: string,
  items: DetectionItem[],
  existingBill: Bill | null,
  source: RecurringBillCandidate["source"],
): RecurringBillCandidate | null {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const sortedDates = sorted.map((item) => item.date);
  const frequency = inferFrequency(sortedDates);

  if (!frequency) {
    return null;
  }

  const amounts = sorted.map((item) => item.amount);

  if (!amountsAreSimilar(amounts)) {
    return null;
  }

  const averageAmount =
    Math.round((amounts.reduce((total, amount) => total + amount, 0) / amounts.length) * 100) /
    100;
  const dueDay = estimateDueDay(sortedDates, frequency);
  const lastPaymentDate = sortedDates[sortedDates.length - 1] ?? null;
  const displayName = displayMerchantName(merchantKey);
  const accountId = sorted[sorted.length - 1]?.accountId ?? null;

  return {
    merchantKey,
    displayName,
    averageAmount,
    dueDay,
    category: inferCategory(merchantKey, sorted[0]?.category ?? "Bills"),
    frequency,
    transactionIds: sorted.map((item) => item.externalTransactionId),
    internalTransactionIds: sorted
      .map((item) => item.internalTransactionId)
      .filter((value): value is string => Boolean(value)),
    accountId,
    paymentAccountId: accountId,
    lastPaymentDate,
    nextEstimatedPaymentDate: lastPaymentDate
      ? estimateNextPaymentDate(lastPaymentDate, frequency)
      : null,
    autopaySuggested: suggestAutopay(sorted),
    source,
    existingBillId: existingBill?.id ?? null,
    action: existingBill ? "update" : "create",
  };
}

function groupDetectionItems(items: DetectionItem[]): Map<string, DetectionItem[]> {
  const groups = new Map<string, DetectionItem[]>();

  for (const item of items) {
    const merchantKey = normalizeMerchantKey(item.notes);

    if (merchantKey.length < 3) {
      continue;
    }

    const existing = groups.get(merchantKey) ?? [];
    existing.push(item);
    groups.set(merchantKey, existing);
  }

  return groups;
}

export function detectRecurringBillCandidatesFromItems(input: {
  items: DetectionItem[];
  bills: Bill[];
  dismissedMerchantKeys?: string[];
}): RecurringBillCandidate[] {
  const dismissed = new Set(
    (input.dismissedMerchantKeys ?? []).map((key) => normalizeMerchantKey(key)),
  );
  const groups = groupDetectionItems(input.items);
  const candidates: RecurringBillCandidate[] = [];

  for (const [merchantKey, groupItems] of groups) {
    if (dismissed.has(merchantKey)) {
      continue;
    }

    if (groupItems.length < MIN_OCCURRENCES) {
      continue;
    }

    const existingBill = findMatchingBill(input.bills, merchantKey, displayMerchantName(merchantKey));
    const candidate = buildCandidateFromGroup(
      merchantKey,
      groupItems,
      existingBill,
      "heuristic",
    );

    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates.sort((left, right) => right.averageAmount - left.averageAmount);
}

export function detectRecurringBillCandidatesFromPlaidTransactions(
  transactions: PlaidMappedTransaction[],
  input: {
    bills: Bill[];
    dismissedMerchantKeys?: string[];
    financeData?: FinanceData;
  },
): RecurringBillCandidate[] {
  return detectRecurringBillCandidatesFromItems({
    items: toDetectionItemsFromPlaid(transactions, input.financeData),
    bills: input.bills,
    dismissedMerchantKeys: input.dismissedMerchantKeys,
  });
}

export function detectRecurringBillCandidatesFromFinanceData(
  data: FinanceData,
  dismissedMerchantKeys: string[] = [],
): RecurringBillCandidate[] {
  const plaidTransactions = data.transactions
    .filter((transaction) => Boolean(transaction.externalTransactionId))
    .map((transaction) => {
      const account = data.accounts.find((item) => item.id === transaction.accountId);

      return {
        externalTransactionId: transaction.externalTransactionId!,
        externalAccountId: account?.externalAccountId ?? transaction.accountId,
        amount: transaction.amount,
        type: transaction.type === "transfer" ? "expense" as const : transaction.type,
        category: transaction.category,
        date: transaction.date,
        notes: transaction.notes ?? transaction.category,
        name: transaction.notes ?? transaction.category,
      } satisfies PlaidMappedTransaction;
    });

  const plaidCandidates = detectRecurringBillCandidatesFromPlaidTransactions(
    plaidTransactions,
    {
      bills: data.bills,
      dismissedMerchantKeys,
      financeData: data,
    },
  );

  const heuristicCandidates = detectRecurringBillCandidatesFromItems({
    items: toDetectionItemsFromFinance(data),
    bills: data.bills,
    dismissedMerchantKeys,
  });

  const merged = new Map<string, RecurringBillCandidate>();

  for (const candidate of [...plaidCandidates, ...heuristicCandidates]) {
    const existing = merged.get(candidate.merchantKey);

    if (!existing || candidate.source === "plaid_api") {
      merged.set(candidate.merchantKey, candidate);
    }
  }

  return Array.from(merged.values()).sort(
    (left, right) => right.averageAmount - left.averageAmount,
  );
}

export function mapPlaidApiStreamToCandidate(input: {
  merchantKey: string;
  displayName: string;
  averageAmount: number;
  frequency: BillFrequency;
  lastDate: string | null;
  category: string;
  accountId?: string | null;
  transactionIds?: string[];
  bills: Bill[];
}): RecurringBillCandidate {
  const existingBill = findMatchingBill(
    input.bills,
    input.merchantKey,
    input.displayName,
  );
  const dueDay = input.lastDate
    ? estimateDueDay([input.lastDate], input.frequency)
    : 1;

  return {
    merchantKey: normalizeMerchantKey(input.merchantKey),
    displayName: input.displayName,
    averageAmount: input.averageAmount,
    dueDay,
    category: inferCategory(normalizeMerchantKey(input.merchantKey), input.category),
    frequency: input.frequency,
    transactionIds: input.transactionIds ?? [],
    internalTransactionIds: [],
    accountId: input.accountId ?? null,
    paymentAccountId: input.accountId ?? null,
    lastPaymentDate: input.lastDate,
    nextEstimatedPaymentDate: input.lastDate
      ? estimateNextPaymentDate(input.lastDate, input.frequency)
      : null,
    autopaySuggested: true,
    source: "plaid_api",
    existingBillId: existingBill?.id ?? null,
    action: existingBill ? "update" : "create",
  };
}

export function candidateToAddBillInput(candidate: RecurringBillCandidate) {
  return {
    name: candidate.displayName,
    amount: candidate.averageAmount,
    dueDay: candidate.dueDay,
    autopay: candidate.autopaySuggested,
    recurring: true,
    category: candidate.category,
    frequency: candidate.frequency,
    startDate: candidate.nextEstimatedPaymentDate ?? candidate.lastPaymentDate ?? undefined,
    paymentAccountId: candidate.paymentAccountId ?? null,
    paycheckAssignment: "first_paycheck" as const,
    splits: [
      {
        amount: candidate.averageAmount,
        dueDay: candidate.dueDay,
        paycheckAssignment: "first_paycheck" as const,
        customPayDay: null,
        paymentAccountId: candidate.paymentAccountId ?? null,
      },
    ],
  };
}

export function candidateToEditBillInput(
  existing: Bill,
  candidate: RecurringBillCandidate,
) {
  return {
    name: existing.name,
    amount: candidate.averageAmount,
    dueDay: candidate.dueDay,
    autopay: candidate.autopaySuggested || existing.autopay,
    recurring: true,
    category: candidate.category || existing.category,
    frequency: candidate.frequency,
    startDate:
      candidate.nextEstimatedPaymentDate ??
      existing.schedule?.startDate ??
      undefined,
    paymentAccountId: candidate.paymentAccountId ?? existing.paymentAccountId ?? null,
    paycheckAssignment: existing.paycheckAssignment ?? "first_paycheck",
    customPayDay: existing.customPayDay ?? null,
    splits:
      existing.splits?.map((split, index) =>
        index === 0
          ? {
              id: split.id,
              amount: candidate.averageAmount,
              dueDay: candidate.dueDay,
              paycheckAssignment: split.paycheckAssignment,
              customPayDay: split.customPayDay,
              paymentAccountId: candidate.paymentAccountId ?? split.paymentAccountId ?? null,
            }
          : split,
      ) ?? undefined,
  };
}

// Exported for tests
export const __testing = {
  inferFrequency,
  amountsAreSimilar,
  normalizeMerchantKey,
};
