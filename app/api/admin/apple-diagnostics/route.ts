import { NextResponse } from "next/server";
import { Environment } from "@apple/app-store-server-library";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { createAppleDiagnosticClient, getVerifiedProductionSubscriptionStatus } from "@/lib/iap/appleServerClient";

import { reconcileActiveAppleSubscription } from "@/lib/iap/appleReconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

/** Read-only live audit. Never applies entitlements or exposes transaction IDs. */
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const { data, error, count } = await auth.adminSupabase.from("profiles")
    .select("id, full_name, subscription_status, subscription_current_period_end, apple_original_transaction_id", { count: "exact" })
    .eq("subscription_provider", "apple").eq("apple_environment", "Production")
    .not("apple_original_transaction_id", "is", null).order("id").limit(20);
  if (error) return NextResponse.json({ error: "Unable to load Apple subscription records." }, { status: 500, headers });
  const records = [];
  for (const row of data ?? []) {
    try {
      const apple = await getVerifiedProductionSubscriptionStatus(row.apple_original_transaction_id!);
      records.push({ userId: row.id, name: row.full_name, storedStatus: row.subscription_status, storedExpiry: row.subscription_current_period_end, ...apple, verified: true });
    } catch {
      records.push({ userId: row.id, name: row.full_name, verified: false, error: "Apple status could not be verified. No account changes made." });
    }
  }
  return NextResponse.json({ mode: "read_only", records, total: count ?? records.length, limit: 20 }, { headers });
}

/** Sends harmless Apple TEST notifications or checks their delivery. */
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers });
  }
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400, headers }); }
  if (body?.action === "reconcile_active") {
    if (typeof body.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId)) {
      return NextResponse.json({ error: "A valid account ID is required." }, { status: 400, headers });
    }
    try {
      return NextResponse.json(await reconcileActiveAppleSubscription(auth.adminSupabase, body.userId), { headers });
    } catch {
      return NextResponse.json({ error: "Subscription could not be safely reconciled. No unverified status was applied." }, { status: 409, headers });
    }
  }
  if (!body || (body.environment !== "Sandbox" && body.environment !== "Production") || !["send_test", "check_test"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid diagnostic action." }, { status: 400, headers });
  }
  if (body.action === "check_test" && (typeof body.token !== "string" || body.token.length < 1 || body.token.length > 512)) {
    return NextResponse.json({ error: "A valid test token is required." }, { status: 400, headers });
  }
  try {
    const client = createAppleDiagnosticClient(body.environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION);
    if (body.action === "send_test") {
      const result = await client.requestTestNotification();
      if (!result.testNotificationToken) throw new Error("Test token missing");
      return NextResponse.json({ token: result.testNotificationToken }, { headers });
    }
    const result = await client.getTestNotificationStatus(body.token);
    return NextResponse.json({ attempts: result.sendAttempts ?? [] }, { headers });
  } catch {
    return NextResponse.json({ error: "Apple diagnostic failed. Check server configuration and try again." }, { status: 502, headers });
  }
}
