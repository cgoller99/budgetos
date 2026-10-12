import type { AutomationProvider, AutomationSuggestion } from "@/lib/automation/types";
import { candidateToAddBillInput } from "@/lib/plaid/recurringBillDetection";
import { detectRecurringBillCandidatesFromFinanceData } from "@/lib/plaid/recurringBillDetection";
import { getBillFrequencyLabel } from "@/lib/recurring/frequencies";

export const plaidAutomationProvider: AutomationProvider = {
  id: "plaid",
  getSuggestions(data, referenceDate = new Date()) {
    const suggestions: AutomationSuggestion[] = [];

    const recurringCandidates = detectRecurringBillCandidatesFromFinanceData(
      data,
      data.plaidRecurringDismissals ?? [],
    ).filter((candidate) => candidate.action === "create");

    for (const candidate of recurringCandidates.slice(0, 2)) {
      const billInput = candidateToAddBillInput(candidate);

      suggestions.push({
        id: `plaid-recurring-bill-${candidate.merchantKey.replace(/[^a-z0-9]+/g, "-")}`,
        kind: "recurring_bill" as const,
        title: "We found a recurring charge",
        description: `${candidate.displayName} looks like a ${getBillFrequencyLabel(candidate.frequency).toLowerCase()} bill around $${candidate.averageAmount.toFixed(2)}.`,
        icon: "📅",
        tone: "accent" as const,
        priority: 85,
        timestamp: referenceDate.toISOString(),
        provider: "plaid",
        entityType: "merchant",
        entityId: candidate.merchantKey,
        detailHref: "/bills",
        primaryAction: {
          label: "Create",
          type: "create_bill",
          payload: billInput,
        },
        secondaryAction: {
          label: "Ignore",
          type: "dismiss",
        },
        tertiaryAction: {
          label: "Never ask again",
          type: "dismiss_permanently",
          payload: {
            merchantKey: candidate.merchantKey,
          },
        },
      });
    }

    return suggestions;
  },
};
