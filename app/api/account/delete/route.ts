import { NextResponse } from "next/server";
import {
  AccountDeletionBlockedError,
  deleteUserAccount,
} from "@/lib/account/deleteAccountService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";

type DeleteBody = {
  confirm?: string;
};

/**
 * App Store–required account deletion.
 * Deletes the authenticated user's data and auth account (server-side only).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireStripeApiUser();
    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const body = (await request.json().catch(() => ({}))) as DeleteBody;
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm account deletion." },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const result = await deleteUserAccount({
      adminSupabase: admin,
      userId: auth.user.id,
    });

    return NextResponse.json({
      ok: true,
      deleted: true,
      alreadyDeleted: Boolean(result.alreadyDeleted),
      stripeSubscriptionCanceled: result.stripeSubscriptionCanceled,
      appleSubscriptionPresent: result.appleSubscriptionPresent,
    });
  } catch (error) {
    console.error("[account/delete] failed", error);

    if (error instanceof AccountDeletionBlockedError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }

    return stripeErrorResponse(error, "Unable to delete account.");
  }
}
