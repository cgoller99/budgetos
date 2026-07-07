/**
 * Probes live buxme.co runtime configuration without Vercel credentials.
 * Used as the authoritative source for production readiness when local
 * .env.local cannot export sensitive Production secrets.
 */

export const DEFAULT_SITE_URL = "https://buxme.co";
export const PRODUCTION_PLAID_WEBHOOK_URL = "https://buxme.co/api/plaid/webhook";

function normalizeSiteUrl(siteUrl) {
  return siteUrl.replace(/\/$/, "");
}

/**
 * @param {string} [siteUrl]
 * @returns {Promise<{
 *   healthy: boolean;
 *   siteUrl: string;
 *   webhookUrl: string;
 *   errors: string[];
 *   checks: string[];
 *   body: Record<string, unknown> | null;
 * }>}
 */
export async function probePlaidProductionHealth(siteUrl = DEFAULT_SITE_URL) {
  const baseUrl = normalizeSiteUrl(siteUrl);
  const webhookUrl = `${baseUrl}/api/plaid/webhook`;
  const errors = [];
  const checks = [];
  let body = null;

  let healthResponse;

  try {
    healthResponse = await fetch(webhookUrl, { method: "GET" });
  } catch (error) {
    errors.push(
      `Cannot reach ${webhookUrl}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return { healthy: false, siteUrl: baseUrl, webhookUrl, errors, checks, body };
  }

  if (healthResponse.status !== 200) {
    errors.push(`GET ${webhookUrl} returned HTTP ${healthResponse.status} (expected 200)`);
    return { healthy: false, siteUrl: baseUrl, webhookUrl, errors, checks, body };
  }

  checks.push(`GET ${webhookUrl} returned HTTP 200`);

  body = await healthResponse.json().catch(() => null);

  if (!body?.ok) {
    errors.push("Webhook health response missing ok=true");
  } else {
    checks.push("Webhook health response ok=true");
  }

  if (body?.environment !== "production") {
    errors.push(`Deployed PLAID_ENV is not production (reported: ${body?.environment ?? "unknown"})`);
  } else {
    checks.push("Deployed environment is production");
  }

  if (body?.webhookUrl !== PRODUCTION_PLAID_WEBHOOK_URL) {
    errors.push(`Deployed webhook URL mismatch: ${body?.webhookUrl ?? "unset"}`);
  } else {
    checks.push("Deployed webhook URL matches production");
  }

  if (body?.verificationRequired !== true) {
    errors.push("Deployed webhook does not require signature verification");
  } else {
    checks.push("Deployed webhook requires signature verification");
  }

  if (body?.configured !== true) {
    errors.push(
      body?.configurationError
        ? `Deployed server reports Plaid is not configured: ${body.configurationError}`
        : "Deployed server reports Plaid is not fully configured",
    );
  } else {
    checks.push("Deployed server reports Plaid is configured");
  }

  const unsignedPost = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhook_type: "TRANSACTIONS",
      webhook_code: "SYNC_UPDATES_AVAILABLE",
      item_id: "production-readiness-probe",
    }),
  });

  if (unsignedPost.status === 401) {
    checks.push("Unsigned webhook POST rejected with HTTP 401");
  } else {
    errors.push(`Unsigned webhook POST returned HTTP ${unsignedPost.status} (expected 401)`);
  }

  return {
    healthy: errors.length === 0,
    siteUrl: baseUrl,
    webhookUrl,
    errors,
    checks,
    body,
  };
}

/**
 * @param {string} [siteUrl]
 * @returns {Promise<{
 *   healthy: boolean;
 *   siteUrl: string;
 *   plaid: Awaited<ReturnType<typeof probePlaidProductionHealth>>;
 * }>}
 */
export async function probeProductionHealth(siteUrl = DEFAULT_SITE_URL) {
  const plaid = await probePlaidProductionHealth(siteUrl);

  return {
    healthy: plaid.healthy,
    siteUrl: normalizeSiteUrl(siteUrl),
    plaid,
  };
}

export function printRemoteHealthSummary(result, { title = "Production runtime (authoritative)" } = {}) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(title);
  console.log("=".repeat(72));
  console.log(`Site: ${result.siteUrl ?? result.plaid?.siteUrl ?? DEFAULT_SITE_URL}\n`);

  for (const check of result.plaid?.checks ?? result.checks ?? []) {
    console.log(`✓ ${check}`);
  }

  for (const error of result.plaid?.errors ?? result.errors ?? []) {
    console.error(`✗ ${error}`);
  }

  if (result.healthy ?? result.plaid?.healthy) {
    console.log("\n✓ Production runtime is healthy — local secret gaps are warnings only.");
  } else {
    console.error("\n✗ Production runtime is unhealthy — fix deployment before shipping.");
  }
}
