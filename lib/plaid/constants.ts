export const PLAID_PRODUCTION_WEBHOOK_URL = "https://buxme.co/api/plaid/webhook";

export const PLAID_WEBHOOK_MAX_AGE = "5 min";

/** Plaid Dashboard → Link → Data Transparency Messaging */
export const PLAID_DATA_TRANSPARENCY_DASHBOARD_URL =
  "https://dashboard.plaid.com/link/data-transparency-v5";

/** Plaid Dashboard → Activity → OAuth institution registration status */
export const PLAID_OAUTH_INSTITUTIONS_DASHBOARD_URL =
  "https://dashboard.plaid.com/activity/status/oauth-institutions";

/** Recommended DTM use cases for Buxme (pick 1–3 in the dashboard). */
export const PLAID_RECOMMENDED_DTM_USE_CASES = [
  "Track and manage your finances",
  "Invest your money",
  "Pay down debt",
] as const;

export const PLAID_DTM_SETUP_INSTRUCTIONS =
  "Configure at least one Data Transparency Messaging use case in Plaid Dashboard → Link → Data Transparency, then click Publish.";
