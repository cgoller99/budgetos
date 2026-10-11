import type { AutomationSuggestion } from "@/lib/automation/types";
import { findSubscriptionPriceIncreases } from "@/lib/automation/financialInsights";
import { formatCurrency } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";
import { detectRecurringBillCandidatesFromFinanceData } from "@/lib/plaid/recurringBillDetection";

function formatEstimatedDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function detectRecurringBillSuggestions(
  data: FinanceData,
  referenceDate = new Date(),
): AutomationSuggestion[] {
  const suggestions: AutomationSuggestion[] = [];
  const candidates = detectRecurringBillCandidatesFromFinanceData(
    data,
    data.plaidRecurringDismissals ?? [],
  );

  for (const candidate of candidates) {
    if (candidate.action !== "create") {
      continue;
    }

    const nextDate = formatEstimatedDate(candidate.nextEstimatedPaymentDate);
    suggestions.push({
      id: `automation-recurring-bill-${candidate.merchantKey.replace(/[^a-z0-9]+/g, "-")}`,
      kind: "recurring_bill",
      title: `Confirm ${candidate.displayName} as a recurring bill?`,
      description: nextDate
        ? `About ${formatCurrency(candidate.averageAmount)} ${candidate.frequency}. The next charge looks like ${nextDate}. Buxme will not add it until you confirm.`
        : `About ${formatCurrency(candidate.averageAmount)} ${candidate.frequency}. Buxme will not add it until you confirm.`,
      icon: "📅",
      tone: "accent",
      priority: candidate.transactionIds.length >= 3 ? 80 : 55,
      timestamp: referenceDate.toISOString(),
      provider: "buxme",
      entityType: "merchant",
      entityId: candidate.merchantKey,
      detailHref: "/bills",
      primaryAction: {
        label: "Create Bill",
        type: "create_bill",
        payload: {
          name: candidate.displayName,
          amount: candidate.averageAmount,
          dueDay: candidate.dueDay,
          autopay: false,
          recurring: true,
          category: candidate.category || "Subscriptions",
          frequency: candidate.frequency,
          paymentAccountId: candidate.paymentAccountId ?? null,
        },
      },
      secondaryAction: {
        label: "Ignore",
        type: "dismiss",
      },
    });
  }

  for (const increase of findSubscriptionPriceIncreases(data)) {
    suggestions.push({
      id: `automation-price-increase-${increase.billId}`,
      kind: "bill_price_increase",
      title: `${increase.name} looks more expensive`,
      description: `The latest payment was ${formatCurrency(increase.latestAmount)}, above the earlier average of ${formatCurrency(increase.previousAverage)}. This does not change the bill until you edit it.`,
      icon: "↑",
      tone: "negative",
      priority: 90,
      timestamp: referenceDate.toISOString(),
      provider: "buxme",
      entityId: increase.billId,
      entityType: "bill",
      detailHref: "/bills",
      primaryAction: {
        label: "Review bill",
        type: "navigate",
        href: "/bills",
      },
      secondaryAction: {
        label: "Dismiss",
        type: "dismiss",
      },
    });
  }

  return suggestions;
}
