import { NextResponse } from "next/server";
import { finalizeBetaRegistrationForUser } from "@/lib/beta/register.server";
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

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Email must be verified before beta registration." },
        { status: 403 },
      );
    }

    const email = user.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const result = await finalizeBetaRegistrationForUser(admin, user.id, email);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[beta/register] Failed", error);
    return NextResponse.json({ error: "Unable to finalize beta registration." }, { status: 500 });
  }
}
