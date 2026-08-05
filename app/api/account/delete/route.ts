import { NextResponse } from "next/server";
import { factoryResetUserFinance } from "@/lib/admin/factoryResetService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";

type DeleteBody = {
  confirm?: string;
};

/**
 * App Store–required account deletion.
 * Deletes the authenticated user's data and auth account.
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
        { error: 'Type DELETE to confirm account deletion.' },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const userId = auth.user.id;

    await factoryResetUserFinance({ adminSupabase: admin, userId });

    // Best-effort household / waitlist cleanup
    await admin.from("household_members").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      throw authDeleteError;
    }

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    console.error("[account/delete] failed", error);
    return stripeErrorResponse(error, "Unable to delete account.");
  }
}
