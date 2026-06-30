export type {
  AutomationAction,
  AutomationActionType,
  AutomationProvider,
  AutomationSuggestion,
  AutomationSuggestionKind,
} from "@/lib/automation/types";
export { MAX_AUTOMATION_SUGGESTIONS } from "@/lib/automation/types";
export {
  computeAutomationSuggestions,
  registerAutomationProvider,
} from "@/lib/automation/computeAutomationSuggestions";
export {
  dismissAutomationSuggestion,
  getDismissedAutomationIds,
  isAutomationSuggestionDismissed,
} from "@/lib/automation/dismissals";
