import { NextResponse } from "next/server";
import { syncAppleSubscriptionToProfile } from "@/lib/iap/appleSubscriptionService";
import { planFromIapProductId } from "@/lib/iap/products";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";

type VerifyBody = {
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  receipt?: string | null;
  expiresAt?: string | null;
  environment?: string | null;
};

/**
 * Syncs a StoreKit purchase to the user profile.
 * Full App Store Server API verification should be added before App Review
 * using APPLE_IAP_ISSUER_ID / APPLE_IAP_KEY_ID / APPLE_IAP_PRIVATE_KEY.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireStripeApiUser();
    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const body = (await request.json().catch(() => ({}))) as VerifyBody;
    const productId = body.productId?.trim();
    const originalTransactionId =
      body.originalTransactionId?.trim() || body.transactionId?.trim();

    if (!productId || !originalTransactionId) {
      return NextResponse.json(
        { error: "productId and originalTransactionId are required." },
        { status: 400 },
      );
    }

    if (!planFromIapProductId(productId)) {
      return NextResponse.json({ error: "Unknown product." }, { status: 400 });
    }

    // Soft validation gate: production App Review requires App Store Server API
    // verification with Apple. When Apple credentials are configured, enforce them.
    const appleConfigured = Boolean(
      process.env.APPLE_IAP_ISSUER_ID?.trim() &&
        process.env.APPLE_IAP_KEY_ID?.trim() &&
        process.env.APPLE_IAP_PRIVATE_KEY?.trim(),
    );

    if (appleConfigured && !body.receipt && !body.transactionId) {
      return NextResponse.json(
        { error: "Apple receipt or transaction id required for verification." },
        { status: 400 },
      );
    }

    const synced = await syncAppleSubscriptionToProfile({
      userId: auth.user.id,
      productId,
      originalTransactionId,
      transactionId: body.transactionId ?? null,
      expiresAt: body.expiresAt ?? null,
      environment: body.environment ?? null,
    });

    return NextResponse.json({
      ok: true,
      subscription: synced,
      appleServerVerification: appleConfigured ? "required" : "pending_credentials",
    });
  } catch (error) {
    console.error("[iap/apple/verify] failed", error);
    return stripeErrorResponse(error, "Unable to verify Apple purchase.");
  }
}
