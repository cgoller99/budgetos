import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeConfig, getStripeConfigDiagnostics } from "@/lib/stripe/config";
import { getStripeWebhookClient } from "@/lib/stripe/stripeClient";
import {
  handleCheckoutSessionCompleted,
  syncSubscriptionToProfile,
} from "@/lib/stripe/subscriptionService";
import { tryLogAdminEvent } from "@/lib/admin/logEventSafe";

export const runtime = "nodejs";

export async function GET() {
  const config = getStripeConfig();
  const siteUrl = config.siteUrl.replace(/\/$/, "");

  return NextResponse.json(
    {
      ok: true,
      service: "stripe-webhook",
      configured: config.isConfigured,
      webhookConfigured: Boolean(config.webhookSecret),
      configurationError: config.configurationError,
      webhookUrl: `${siteUrl}/api/stripe/webhook`,
      liveMode: config.secretKey?.startsWith("sk_live_") ?? false,
      checks: getStripeConfigDiagnostics(),
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const config = getStripeConfig();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = config.webhookSecret;

  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is missing.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    const stripe = getStripeWebhookClient();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe/webhook] Signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        await tryLogAdminEvent({
          eventType: "stripe",
          message: `Checkout completed (${event.id})`,
          metadata: { type: event.type },
        });
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripe = getStripeWebhookClient();
        const subscriptionPayload = event.data.object as Stripe.Subscription;
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionPayload.id,
          { expand: ["items.data.price.product"] },
        );
        await syncSubscriptionToProfile(subscription);
        await tryLogAdminEvent({
          eventType: "stripe",
          message: `${event.type} (${subscription.id})`,
          metadata: { type: event.type, status: subscription.status },
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef =
          invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subscriptionRef === "string"
            ? subscriptionRef
            : subscriptionRef?.id;

        if (subscriptionId) {
          const stripe = getStripeWebhookClient();
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
            { expand: ["items.data.price.product"] },
          );
          await syncSubscriptionToProfile(subscription);
          await tryLogAdminEvent({
            eventType: "stripe",
            message: `invoice.payment_failed (${subscription.id})`,
            metadata: {
              type: event.type,
              status: subscription.status,
              invoiceId: invoice.id,
            },
          });
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] Failed to process event", event.type, error);
    await tryLogAdminEvent({
      eventType: "api_failure",
      message: `Stripe webhook failed for ${event.type}`,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
