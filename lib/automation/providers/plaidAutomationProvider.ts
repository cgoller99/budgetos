import type { AutomationProvider } from "@/lib/automation/types";

/**
 * Future Plaid direct-deposit suggestions plug in here.
 * Returns empty until Plaid integration is enabled.
 */
export const plaidAutomationProvider: AutomationProvider = {
  id: "plaid",
  getSuggestions() {
    return [];
  },
};
