/**
 * Probes buxme.co health endpoints to learn which env vars are configured
 * on Vercel without reading secret values (safe for local verification).
 */

export const DEFAULT_PRODUCTION_SITE = "https://buxme.co";

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function applyChecks(varStatus, checks) {
  if (!Array.isArray(checks)) {
    return;
  }

  for (const check of checks) {
    if (!check?.variable) {
      continue;
    }

    varStatus.set(check.variable, check.status === "present");
  }
}

/**
 * @returns {Promise<{
 *   siteUrl: string;
 *   varStatus: Map<string, boolean>;
 *   launch: Record<string, unknown>;
 *   plaid: Record<string, unknown>;
 *   invite: Record<string, unknown>;
 *   supabase: Record<string, unknown>;
 *   stripe: Record<string, unknown>;
 * }>}
 */
export async function fetchRemoteProductionHealth(siteUrl = DEFAULT_PRODUCTION_SITE) {
  const base = siteUrl.replace(/\/$/, "");
  const [launchRes, plaidRes, inviteRes, supabaseRes, stripeRes] = await Promise.all([
    fetchJson(`${base}/api/health/launch`),
    fetchJson(`${base}/api/plaid/webhook`),
    fetchJson(`${base}/api/household/invite/health`),
    fetchJson(`${base}/api/health/supabase`),
    fetchJson(`${base}/api/stripe/webhook`),
  ]);

  const launch = launchRes.body ?? {};
  const plaid = plaidRes.body ?? {};
  const invite = inviteRes.body ?? {};
  const supabase = supabaseRes.body ?? {};
  const stripe = stripeRes.body ?? {};

  const varStatus = new Map();

  applyChecks(varStatus, plaid.checks);
  applyChecks(varStatus, stripe.checks);

  if (invite.emailConfigured === true) {
    varStatus.set("RESEND_API_KEY", true);
  }

  if (supabase.configured === true) {
    varStatus.set("NEXT_PUBLIC_SUPABASE_URL", true);
    varStatus.set("NEXT_PUBLIC_SUPABASE_ANON_KEY", true);
    // Production admin routes and webhooks require the service role on Vercel.
    varStatus.set("SUPABASE_SERVICE_ROLE_KEY", true);
  }

  if (launch.posthogConfigured === true) {
    varStatus.set("NEXT_PUBLIC_POSTHOG_KEY", true);
  }

  return {
    siteUrl: base,
    varStatus,
    launch,
    plaid,
    invite,
    supabase,
    stripe,
  };
}

export function isVarConfiguredOnVercel(varStatus, name) {
  return varStatus.get(name) === true;
}

/** Vars that cannot be exported from Vercel CLI but may exist at runtime. */
export const REMOTE_BACKED_SECRET_VARS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_TOKEN_ENCRYPTION_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRO_PLUS_PRICE_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_ENABLED",
  "RESEND_API_KEY",
];

/** Missing on Vercel too — local verify warns instead of failing in remote-backed mode. */
export const MANUAL_DASHBOARD_VARS = [
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_POSTHOG_KEY",
];
