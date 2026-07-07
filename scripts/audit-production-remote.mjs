#!/usr/bin/env node
/**
 * Audits the live buxme.co deployment for missing server configuration.
 * Does not require Vercel credentials — probes public health endpoints only.
 *
 * Usage:
 *   npm run audit:remote
 *   node scripts/audit-production-remote.mjs --url https://buxme.co
 */

const DEFAULT_SITE = "https://buxme.co";

function getSiteUrl() {
  const index = process.argv.indexOf("--url");
  const value = index === -1 ? DEFAULT_SITE : process.argv[index + 1];
  return value.replace(/\/$/, "");
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function report(ok, label, detail = "") {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${label}${detail ? `: ${detail}` : ""}`);
  return ok;
}

async function main() {
  const siteUrl = getSiteUrl();
  let allOk = true;

  console.log(`Buxme remote production audit (${siteUrl})\n`);

  const plaid = await fetchJson(`${siteUrl}/api/plaid/webhook`);
  allOk =
    report(plaid.ok, "Plaid webhook route reachable", `HTTP ${plaid.status}`) && allOk;
  allOk =
    report(
      plaid.body?.environment === "production",
      "Plaid environment is production",
      plaid.body?.environment ?? "unknown",
    ) && allOk;
  allOk =
    report(
      plaid.body?.configured === true,
      "Plaid configured on Vercel",
      plaid.body?.configured ? "configured" : "missing PLAID_CLIENT_ID or related vars",
    ) && allOk;
  allOk =
    report(
      plaid.body?.webhookUrl === `${siteUrl}/api/plaid/webhook`,
      "Plaid webhook URL",
      plaid.body?.webhookUrl ?? "unknown",
    ) && allOk;

  const invite = await fetchJson(`${siteUrl}/api/household/invite/health`);
  allOk =
    report(invite.ok, "Invite email health route reachable", `HTTP ${invite.status}`) && allOk;
  allOk =
    report(
      invite.body?.emailConfigured === true,
      "Resend configured on Vercel",
      invite.body?.emailConfigured ? invite.body.fromEmail : invite.body?.configurationError ?? "missing RESEND_API_KEY",
    ) && allOk;

  console.log("\nLocal .env.local gaps (server secrets — copy from Vercel Production):");
  const localOnly = [
    "PLAID_CLIENT_ID",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_PRO_PLUS_PRICE_ID",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_POSTHOG_KEY",
  ];

  for (const name of localOnly) {
    console.log(`  • ${name}`);
  }

  console.log("\nFix Vercel + local env:");
  console.log("  vercel login");
  console.log("  vercel env pull .env.local --environment=production");
  console.log("  npm run sync:env");
  console.log("  npm run verify:production");

  console.log("\nSupabase (if verify:supabase reports RLS gaps):");
  console.log("  npm run apply:admin-feedback-rls");
  console.log("  Or run supabase/migrations/20260709_admin_feedback_rls.sql in SQL Editor");

  console.log("");
  if (!allOk) {
    console.error("❌ Remote production audit found issues.");
    process.exit(1);
  }

  console.log("✅ Remote production audit passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
