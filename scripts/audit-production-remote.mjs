#!/usr/bin/env node
/**
 * Audits the live buxme.co deployment for beta launch readiness.
 * Probes public health endpoints only — no Vercel credentials required.
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

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

function report(ok, label, detail = "") {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${label}${detail ? `: ${detail}` : ""}`);
  return ok;
}

function warn(label, detail = "") {
  console.log(`⚠ ${label}${detail ? `: ${detail}` : ""}`);
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

  console.log("\nPlaid DTM (manual dashboard step):");
  warn(
    "Publish use cases at",
    plaid.body?.dataTransparencyDashboardUrl ??
      "https://dashboard.plaid.com/link/data-transparency-v5",
  );
  if (Array.isArray(plaid.body?.recommendedDtmUseCases)) {
    for (const useCase of plaid.body.recommendedDtmUseCases) {
      console.log(`  • ${useCase}`);
    }
  }
  warn(
    "OAuth institutions (Schwab, PNC, etc.)",
    "https://dashboard.plaid.com/activity/status/oauth-institutions",
  );

  const invite = await fetchJson(`${siteUrl}/api/household/invite/health`);
  allOk =
    report(invite.ok, "Invite email health route reachable", `HTTP ${invite.status}`) && allOk;
  allOk =
    report(
      invite.body?.emailConfigured === true,
      "Resend configured on Vercel",
      invite.body?.emailConfigured ? invite.body.fromEmail : invite.body?.configurationError ?? "missing RESEND_API_KEY",
    ) && allOk;

  console.log("\nLaunch configuration:");
  const launch = await fetchJson(`${siteUrl}/api/health/launch`);
  if (launch.ok) {
    allOk =
      report(
        launch.body?.cronSecretConfigured === true,
        "CRON_SECRET configured",
        launch.body?.cronSecretConfigured ? "present" : "missing on Vercel",
      ) && allOk;

    if (!launch.body?.posthogConfigured) {
      warn("NEXT_PUBLIC_POSTHOG_KEY", "missing on Vercel — analytics disabled");
    } else {
      report(true, "PostHog configured", "NEXT_PUBLIC_POSTHOG_KEY present");
    }

    if (!launch.body?.stripeWebhookConfigured) {
      warn(
        "STRIPE_WEBHOOK_SECRET",
        "missing — paid subscriptions will not sync (OK for free beta)",
      );
    } else {
      report(true, "Stripe webhook secret configured", "present");
    }

    report(
      launch.body?.stripeConfigured === true,
      "Stripe checkout configured",
      launch.body?.stripeConfigured ? "live keys present" : launch.body?.configurationError ?? "incomplete",
    );
  } else {
    allOk = report(false, "Launch health endpoint reachable", `HTTP ${launch.status}`) && allOk;
  }

  const stripe = await fetchJson(`${siteUrl}/api/stripe/webhook`);
  report(
    stripe.body?.webhookConfigured === true,
    "Stripe webhook handler ready",
    stripe.body?.webhookConfigured ? "secret present" : "returns 503 on POST until STRIPE_WEBHOOK_SECRET is set",
  );

  const cronProbe = await fetchJson(`${siteUrl}/api/cron/run-paychecks`);
  allOk =
    report(
      cronProbe.status === 401,
      "Cron route rejects unauthenticated requests",
      `HTTP ${cronProbe.status}`,
    ) && allOk;

  console.log("\nSupabase RLS:");
  const supabaseHealth = await fetchJson(`${siteUrl}/api/health/supabase`);
  if (supabaseHealth.ok && supabaseHealth.body?.configured) {
    allOk =
      report(
        supabaseHealth.body?.adminFeedbackRlsEnabled === true,
        "admin_feedback_reports RLS enabled",
        supabaseHealth.body?.adminFeedbackRlsEnabled
          ? "anonymous writes blocked"
          : "anonymous writes still allowed — run npm run apply:admin-feedback-rls",
      ) && allOk;
    report(
      supabaseHealth.body?.allRequiredTablesProtected === true,
      "User/household tables block anonymous writes",
      `${supabaseHealth.body?.tablesBlockingAnonWrites ?? 0}/${supabaseHealth.body?.tablesChecked ?? 0} tables protected`,
    );
  } else {
    allOk =
      report(
        false,
        "Supabase RLS health endpoint",
        supabaseHealth.ok ? "misconfigured" : `HTTP ${supabaseHealth.status}`,
      ) && allOk;
  }

  console.log("\nIf RLS is not applied:");
  console.log("  npm run apply:admin-feedback-rls");
  console.log("  Or run supabase/migrations/20260709_admin_feedback_rls.sql in SQL Editor");

  console.log("\nSupabase Auth URLs (verify in dashboard):");
  console.log("  npm run configure:supabase-auth-urls");
  console.log("  Site URL: https://buxme.co");
  console.log("  Redirects: /auth/callback, /household/invite/*, localhost callbacks");

  console.log("\nPhone smoke test:");
  console.log("  docs/SMOKE_TEST.md");

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
