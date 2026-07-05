import { NextResponse } from "next/server";
import { resolveBetaStatusForSignup } from "@/lib/beta/access.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const betaStatus = await resolveBetaStatusForSignup(admin, email);

    const { error } = await admin
      .from("profiles")
      .update({ beta_status: betaStatus, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ betaStatus });
  } catch (error) {
    console.error("[beta/register] Failed", error);
    return NextResponse.json({ error: "Unable to finalize beta registration." }, { status: 500 });
  }
}
