import type { FinanceEventTone } from "@/lib/events/types";

export type AutomationSuggestionKind =
  | "recurring_bill"
  | "paycheck_detected"
  | "goal_fundable"
  | "extra_paycheck_month"
  | "allocation_unfunded"
  | "emergency_fund_low";

export type AutomationActionType =
  | "create_bill"
  | "apply_paycheck"
  | "navigate"
  | "dismiss"
  | "skip";

export type AutomationAction = {
  label: string;
  type: AutomationActionType;
  href?: string;
  payload?: Record<string, unknown>;
};

export type AutomationSuggestion = {
  id: string;
  kind: AutomationSuggestionKind;
  title: string;
  description: string;
  icon: string;
  tone: FinanceEventTone;
  priority: number;
  timestamp: string;
  provider: string;
  entityId?: string;
  entityType?: string;
  primaryAction: AutomationAction;
  secondaryAction?: AutomationAction;
  detailHref?: string;
};

export type AutomationProvider = {
  id: string;
  getSuggestions: (
    data: import("@/lib/finance/types").FinanceData,
    referenceDate?: Date,
  ) => AutomationSuggestion[];
};

export const MAX_AUTOMATION_SUGGESTIONS = 3;
