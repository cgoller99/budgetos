import { NextResponse } from "next/server";
import { getStripeConfig } from "@/lib/stripe/config";

export const runtime = "nodejs";

export async function GET() {
  const stripe = getStripeConfig();
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const posthogConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
  const stripeWebhookConfigured = Boolean(stripe.webhookSecret);
  const stripeLiveMode = stripe.secretKey?.startsWith("sk_live_") ?? false;

  return NextResponse.json({
    ok: true,
    service: "launch-health",
    posthogConfigured,
    stripeConfigured: stripe.isConfigured,
    stripeWebhookConfigured,
    stripeLiveMode,
    cronSecretConfigured,
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
      "https://buxme.co",
  });
}
