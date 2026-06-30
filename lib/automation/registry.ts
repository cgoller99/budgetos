import { detectPaycheckSuggestions } from "@/lib/automation/detectPaycheck";
import { detectRecurringBillSuggestions } from "@/lib/automation/detectRecurringBills";
import { detectSmartSuggestions } from "@/lib/automation/detectSmartSuggestions";
import type { AutomationProvider, AutomationSuggestion } from "@/lib/automation/types";
import type { FinanceData } from "@/lib/finance/types";

const buxmeAutomationProvider: AutomationProvider = {
  id: "buxme",
  getSuggestions(data, referenceDate = new Date()) {
    return [
      ...detectPaycheckSuggestions(data, referenceDate),
      ...detectRecurringBillSuggestions(data, referenceDate),
      ...detectSmartSuggestions(data, referenceDate),
    ];
  },
};

const providers: AutomationProvider[] = [buxmeAutomationProvider];

export function registerAutomationProvider(provider: AutomationProvider): void {
  if (providers.some((item) => item.id === provider.id)) {
    return;
  }

  providers.push(provider);
}

export function getAutomationProviders(): AutomationProvider[] {
  return [...providers];
}

export function collectAutomationSuggestions(
  data: FinanceData,
  referenceDate = new Date(),
): AutomationSuggestion[] {
  return providers.flatMap((provider) =>
    provider.getSuggestions(data, referenceDate),
  );
}
