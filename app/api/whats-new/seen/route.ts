import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { markReleaseSeen } from "@/lib/whatsNew/releaseService";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { releaseId?: string };

  try {
    body = (await request.json()) as { releaseId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.releaseId) {
    return NextResponse.json({ error: "releaseId is required." }, { status: 400 });
  }

  try {
    await markReleaseSeen(supabase, user.id, body.releaseId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[whats-new/seen] failed", error);
    return NextResponse.json(
      { error: "Unable to save release view." },
      { status: 500 },
    );
  }
}
