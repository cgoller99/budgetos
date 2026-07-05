import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_step, onboarding_progress, onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unable to load onboarding progress." }, { status: 500 });
  }

  return NextResponse.json({
    step: data?.onboarding_step ?? 1,
    progress: data?.onboarding_progress ?? {},
    complete: data?.onboarding_complete ?? false,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    step?: number;
    progress?: Record<string, unknown>;
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_step: body.step,
      onboarding_progress: body.progress ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Unable to save progress." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
