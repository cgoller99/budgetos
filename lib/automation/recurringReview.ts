import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import type { BillFrequency } from "@/lib/finance/types";
import type { RecurringBillCandidate } from "@/lib/plaid/types";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

export type RecurringKind =
  | "subscription"
  | "insurance"
  | "utility"
  | "loan"
  | "membership"
  | "other";

export type RecurringConfidence = "likely" | "needs_confirmation";

export type RecurringPriceChange = {
  previousAverage: number;
  latestAmount: number;
};

export type RecurringReviewItem = {
  merchantKey: string;
  merchant: string;
  typicalAmount: number;
  frequency: BillFrequency;
  nextCharge: string | null;
  monthlyEquivalent: number;
  annualEquivalent: number;
  kind: RecurringKind;
  kindLabel: string;
  confidence: RecurringConfidence;
  confidenceLabel: string;
  priceChange: RecurringPriceChange | null;
  candidate: RecurringBillCandidate;
};

const MEMBERSHIP_MERCHANTS = [
  "planet fitness",
  "peloton",
  "orangetheory",
  "equinox",
  "ymca",
  "crossfit",
  "gym",
];

const SUBSCRIPTION_MERCHANTS = [
  "netflix",
  "spotify",
  "hulu",
  "disney",
  "apple",
  "amazon prime",
  "youtube",
  "icloud",
  "hbo",
  "max.com",
];

const UTILITY_MERCHANTS = [
  "georgia power",
  "electric",
  "water",
  "internet",
  "comcast",
  "xfinity",
  "att",
  "verizon",
  "tmobile",
  "t-mobile",
  "duke energy",
  "pg&e",
  "pge",
];

const INSURANCE_MERCHANTS = [
  "insurance",
  "geico",
  "progressive",
  "state farm",
  "allstate",
  "usaa",
];

const LOAN_MERCHANTS = [
  "loan",
  "mortgage",
  "nelnet",
  "mohela",
  "navient",
  "sofi",
  "car payment",
  "auto finance",
  "honda finance",
];

const KIND_LABELS: Record<RecurringKind, string> = {
  subscription: "Subscription",
  insurance: "Insurance",
  utility: "Utility",
  loan: "Loan payment",
  membership: "Membership",
  other: "Recurring bill",
};

function includesMerchant(merchantKey: string, markers: string[]): boolean {
  return markers.some((marker) => merchantKey.includes(marker));
}

export function classifyRecurringKind(input: {
  merchantKey: string;
  category?: string | null;
}): RecurringKind {
  const merchant = input.merchantKey.toLowerCase();
  const category = getDisplayCategory(input.category).toLowerCase();

  if (
    includesMerchant(merchant, MEMBERSHIP_MERCHANTS) ||
    category.includes("membership")
  ) {
    return "membership";
  }

  if (
    includesMerchant(merchant, INSURANCE_MERCHANTS) ||
    category === "insurance"
  ) {
    return "insurance";
  }

  if (includesMerchant(merchant, UTILITY_MERCHANTS) || category === "utilities") {
    return "utility";
  }

  if (
    includesMerchant(merchant, LOAN_MERCHANTS) ||
    category === "loan payment" ||
    category === "mortgage" ||
    category === "credit card payment"
  ) {
    return "loan";
  }

  if (
    includesMerchant(merchant, SUBSCRIPTION_MERCHANTS) ||
    category === "subscriptions"
  ) {
    return "subscription";
  }

  return "other";
}

export function categoryForRecurringCandidate(
  merchantKey: string,
  fallback: string,
): string {
  const merchant = merchantKey.toLowerCase();
  if (merchant.includes("rent") || merchant.includes("landlord")) {
    return "Housing";
  }

  const kind = classifyRecurringKind({ merchantKey, category: fallback });
  if (kind === "other") {
    return fallback || "Bills";
  }

  return billCategoryForKind(kind);
}

export function billCategoryForKind(kind: RecurringKind): string {
  switch (kind) {
    case "subscription":
      return "Subscriptions";
    case "insurance":
      return "Insurance";
    case "utility":
      return "Utilities";
    case "loan":
      return "Loans";
    case "membership":
      return "Memberships";
    default:
      return "Other";
  }
}

export function recurringKindLabel(kind: RecurringKind): string {
  return KIND_LABELS[kind];
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function recurringEquivalents(
  amount: number,
  frequency: string,
): { monthly: number; annual: number } {
  const monthly = roundCurrency(toMonthlyAmount(amount, frequency));
  return { monthly, annual: roundCurrency(monthly * 12) };
}

export function recurringEvidenceKey(candidate: RecurringBillCandidate): string {
  return [
    candidate.transactionIds.length,
    candidate.lastPaymentDate ?? "",
    candidate.averageAmount.toFixed(2),
  ].join("|");
}

export function isRecurringDismissalCurrent(
  storedEvidence: string | undefined,
  candidate: RecurringBillCandidate,
): boolean {
  if (!storedEvidence) {
    return false;
  }

  return storedEvidence === recurringEvidenceKey(candidate);
}

export function recurringPriceChange(
  payments: Array<{ amount: number; date: string }>,
): RecurringPriceChange | null {
  if (payments.length < 2) {
    return null;
  }

  const sorted = [...payments].sort((left, right) => right.date.localeCompare(left.date));
  const latest = sorted[0]!;
  const prior = sorted.slice(1, 4);
  const previousAverage =
    prior.reduce((total, payment) => total + payment.amount, 0) / prior.length;

  if (
    previousAverage > 0 &&
    latest.amount - previousAverage >= 1 &&
    latest.amount >= previousAverage * 1.08
  ) {
    return {
      previousAverage: roundCurrency(previousAverage),
      latestAmount: roundCurrency(latest.amount),
    };
  }

  return null;
}

export function buildRecurringReview(
  candidates: RecurringBillCandidate[],
  input: {
    transactions?: Array<{ id: string; amount: number; date: string }>;
    dismissals?: Record<string, string>;
  } = {},
): RecurringReviewItem[] {
  const transactions = input.transactions ?? [];
  const dismissals = input.dismissals ?? {};

  return candidates
    .filter((candidate) => candidate.action === "create")
    .filter(
      (candidate) =>
        !isRecurringDismissalCurrent(dismissals[candidate.merchantKey], candidate),
    )
    .map((candidate) => {
      const kind = classifyRecurringKind({
        merchantKey: candidate.merchantKey,
        category: candidate.category,
      });
      const equivalents = recurringEquivalents(
        candidate.averageAmount,
        candidate.frequency,
      );
      const linked = transactions.filter((transaction) =>
        candidate.internalTransactionIds.includes(transaction.id),
      );
      const likely = candidate.transactionIds.length >= 3;

      return {
        merchantKey: candidate.merchantKey,
        merchant: candidate.displayName,
        typicalAmount: candidate.averageAmount,
        frequency: candidate.frequency,
        nextCharge: candidate.nextEstimatedPaymentDate ?? null,
        monthlyEquivalent: equivalents.monthly,
        annualEquivalent: equivalents.annual,
        kind,
        kindLabel: recurringKindLabel(kind),
        confidence: likely ? "likely" : "needs_confirmation",
        confidenceLabel: likely ? "Likely" : "Needs confirmation",
        priceChange: recurringPriceChange(linked),
        candidate,
      };
    });
}
