import {
  collectAutomationSuggestions,
  getAutomationProviders,
  registerAutomationProvider,
} from "@/lib/automation/registry";
import type { AutomationSuggestion } from "@/lib/automation/types";
import { MAX_AUTOMATION_SUGGESTIONS } from "@/lib/automation/types";
import type { FinanceData } from "@/lib/finance/types";

function dedupeSuggestions(
  suggestions: AutomationSuggestion[],
): AutomationSuggestion[] {
  const seen = new Set<string>();
  const deduped: AutomationSuggestion[] = [];

  for (const suggestion of suggestions.sort(
    (left, right) => right.priority - left.priority,
  )) {
    if (seen.has(suggestion.id)) {
      continue;
    }

    seen.add(suggestion.id);
    deduped.push(suggestion);
  }

  return deduped;
}

export function computeAutomationSuggestions(
  data: FinanceData,
  dismissedIds: Set<string>,
  referenceDate = new Date(),
): AutomationSuggestion[] {
  const suggestions = collectAutomationSuggestions(data, referenceDate).filter(
    (suggestion) => !dismissedIds.has(suggestion.id),
  );

  return dedupeSuggestions(suggestions).slice(0, MAX_AUTOMATION_SUGGESTIONS);
}

export {
  collectAutomationSuggestions,
  getAutomationProviders,
  registerAutomationProvider,
};
