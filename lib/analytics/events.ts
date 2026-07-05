export const ANALYTICS_EVENTS = {
  ACCOUNT_CREATED: "account_created",
  LOGIN: "login",
  COMPLETED_ONBOARDING: "completed_onboarding",
  CREATED_INCOME_PLAN: "created_income_plan",
  CREATED_GOAL: "created_goal",
  ADDED_BILL: "added_bill",
  ADDED_ACCOUNT: "added_account",
  CONNECTED_PLAID: "connected_plaid",
  INVITED_HOUSEHOLD: "invited_household",
  ACCEPTED_INVITE: "accepted_invite",
  OPENED_DASHBOARD: "opened_dashboard",
  CREATED_BUDGET: "created_budget",
  VIEWED_REPORTS: "viewed_reports",
  STRIPE_CHECKOUT_STARTED: "stripe_checkout_started",
  SUBSCRIPTION_PURCHASED: "subscription_purchased",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",
  SUBSCRIPTION_DOWNGRADED: "subscription_downgraded",
  COMPLETED_FEEDBACK: "completed_feedback",
  BETA_WAITLIST_JOINED: "beta_waitlist_joined",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;
