export type FinanceEventType =
  | "account_added"
  | "bill_added"
  | "bill_updated"
  | "bill_deleted"
  | "bill_paid"
  | "bill_due_tomorrow"
  | "income_added"
  | "goal_created"
  | "goal_updated"
  | "goal_contribution"
  | "goal_completed"
  | "transaction_added"
  | "transaction_updated"
  | "transaction_deleted"
  | "debt_added"
  | "debt_payment"
  | "paycheck_processed"
  | "activity_applied"
  | "net_worth_milestone"
  | "weekly_summary_ready"
  | "household_invite_accepted";

export type FinanceEventTone = "positive" | "negative" | "neutral" | "accent";

export type FinanceEventSurface =
  | "activity"
  | "notification"
  | "report"
  | "roadmap";

export type FinanceEvent = {
  id: string;
  type: FinanceEventType;
  label: string;
  description: string;
  icon: string;
  tone: FinanceEventTone;
  surfaces: FinanceEventSurface[];
  entityId?: string;
  entityType?: string;
  amount?: number;
  timestamp: string;
  read: boolean;
};

export type ActivityItem = {
  id: string;
  label: string;
  description: string;
  icon: string;
  tone: FinanceEventTone;
  timestamp: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: FinanceEventTone;
  timestamp: string;
  read: boolean;
  automationSuggestionId?: string;
  detailHref?: string;
  actions?: {
    primary: {
      label: string;
      type: string;
      href?: string;
      payload?: Record<string, unknown>;
    };
    secondary?: {
      label: string;
      type: string;
      href?: string;
      payload?: Record<string, unknown>;
    };
  };
};

export const MAX_EVENT_HISTORY = 200;
