import type { AutomationSuggestion } from "@/lib/automation/types";
import {
  buildPaycheckReviews,
  paycheckReviewDescription,
  paycheckReviewSuggestionId,
} from "@/lib/automation/paycheckReview";
import type { FinanceData } from "@/lib/finance/types";

export function detectPaycheckSuggestions(
  data: FinanceData,
  referenceDate = new Date(),
): AutomationSuggestion[] {
  return buildPaycheckReviews(data, referenceDate)
    .filter((item) => item.canApply)
    .map((item) => ({
      id: paycheckReviewSuggestionId(item.transactionId),
      kind: "paycheck_detected" as const,
      title: "Paycheck detected.",
      description: paycheckReviewDescription(item),
      icon: "💵",
      tone: "accent" as const,
      priority: item.confidence === "likely" ? 100 : 70,
      timestamp: item.expectedPayDate ?? referenceDate.toISOString(),
      provider: "buxme",
      entityId: item.transactionId,
      entityType: "transaction",
      detailHref: "/income?tab=plan",
      primaryAction: {
        label: "Apply",
        type: "apply_paycheck" as const,
        payload: {
          transactionId: item.transactionId,
          merchant: item.merchant,
          actualAmount: item.actualAmount,
          expectedAmount: item.expectedAmount,
          planAmount: item.planAmount,
          frequencyLabel: item.frequencyLabel,
          expectedPayDate: item.expectedPayDate,
          matchedSourceName: item.matchedSourceName,
          confidence: item.confidence,
          allocations: item.allocations,
        },
      },
      secondaryAction: {
        label: "Skip",
        type: "skip" as const,
      },
    }));
}
