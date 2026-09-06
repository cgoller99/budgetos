import { NextResponse } from "next/server";
import { getAppleIapConfig } from "@/lib/iap/config";
import {
  ApplePurchaseVerificationError,
  verifyAndSyncApplePurchaseForUser,
} from "@/lib/iap/appleVerifyPurchase";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";

type VerifyBody = {
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  signedTransactionInfo?: string | null;
  environment?: string | null;
};

/**
 * Verifies an Apple IAP purchase with App Store Server APIs / signed transactions,
 * then grants Premium only from trusted server-side data.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireStripeApiUser();
    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const appleConfig = getAppleIapConfig();
    if (!appleConfig.isConfigured) {
      return NextResponse.json(
        {
          error:
            "Apple In-App Purchase verification is temporarily unavailable. Contact support@buxme.co.",
          code: "APPLE_IAP_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as VerifyBody;

    const result = await verifyAndSyncApplePurchaseForUser({
      userId: auth.user.id,
      payload: {
        productId: body.productId,
        transactionId: body.transactionId,
        originalTransactionId: body.originalTransactionId,
        signedTransactionInfo: body.signedTransactionInfo,
        environment: body.environment,
      },
    });

    return NextResponse.json({
      ok: true,
      subscription: {
        plan: result.plan,
        status: result.status,
      },
      appleServerVerification: "verified",
      verified: {
        productId: result.verified.productId,
        originalTransactionId: result.verified.originalTransactionId,
        expiresAt: result.verified.expiresAt,
        environment: result.verified.environment,
      },
    });
  } catch (error) {
    console.error("[iap/apple/verify] failed", error);

    if (error instanceof ApplePurchaseVerificationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          // Safe ownership diagnostics (UUIDs / Apple transaction ids — not secrets).
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.status },
      );
    }

    return stripeErrorResponse(error, "Unable to verify Apple purchase.");
  }
}
