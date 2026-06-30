import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeConfig } from "@/lib/stripe/config";
import { getStripeWebhookClient } from "@/lib/stripe/stripeClient";
import {
  handleCheckoutSessionCompleted,
  syncSubscriptionToProfile,
} from "@/lib/stripe/subscriptionService";

export const runtime = "nodejs";

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
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripe = getStripeWebhookClient();
        const subscriptionPayload = event.data.object as Stripe.Subscription;
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionPayload.id,
          { expand: ["items.data.price.product"] },
        );
        await syncSubscriptionToProfile(subscription);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook] Failed to process event", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
