import { NextResponse } from "next/server";
import { tryLogAdminEvent } from "@/lib/admin/logEventSafe";
import { getPlaidConfig, resolvePlaidWebhookUrl } from "@/lib/plaid/config";
import { parsePlaidWebhookEvent } from "@/lib/plaid/webhookEvents";
import { processPlaidWebhookEvent } from "@/lib/plaid/webhookProcessor";
import { verifyPlaidWebhook } from "@/lib/plaid/webhookVerification";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const config = getPlaidConfig();
  const webhookUrl = resolvePlaidWebhookUrl(config);

  return NextResponse.json(
    {
      ok: true,
      service: "plaid-webhook",
      environment: config.environment,
      webhookUrl,
      configured: config.isConfigured,
      verificationRequired: config.environment === "production",
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const config = getPlaidConfig();
  const body = await request.text();
  const verificationHeader = request.headers.get("plaid-verification");

  if (!config.isConfigured) {
    console.error("[plaid/webhook] Plaid is not configured:", config.configurationError);
    return NextResponse.json({ error: "Plaid is not configured." }, { status: 503 });
  }

  const verification = await verifyPlaidWebhook(body, verificationHeader);

  if (!verification.verified) {
    console.error("[plaid/webhook] Signature verification failed:", verification.reason);
    await tryLogAdminEvent({
      eventType: "plaid",
      message: "Plaid webhook verification failed",
      metadata: { reason: verification.reason },
    });
    return NextResponse.json({ error: "Invalid Plaid webhook signature." }, { status: 401 });
  }

  let event;

  try {
    event = parsePlaidWebhookEvent(body);
  } catch (error) {
    console.error("[plaid/webhook] Invalid JSON payload", error);
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await processPlaidWebhookEvent({ event, supabase });

    if (result.status === "processed") {
      await tryLogAdminEvent({
        eventType: "plaid",
        message: `Processed ${result.webhookType}/${result.webhookCode}`,
        metadata: {
          itemId: event.item_id,
          connectionId: result.connectionId,
          syncTriggered: result.syncTriggered ?? false,
          environment: event.environment ?? config.environment,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        webhookType: result.webhookType,
        webhookCode: result.webhookCode,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[plaid/webhook] Failed to process webhook", error);
    await tryLogAdminEvent({
      eventType: "api_failure",
      message: "Plaid webhook handler failed",
      metadata: {
        webhookType: event.webhook_type,
        webhookCode: event.webhook_code,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
