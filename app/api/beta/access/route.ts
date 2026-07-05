import { NextResponse } from "next/server";
import { checkBetaRegistrationAccess } from "@/lib/beta/access.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AccessBody = {
  email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AccessBody;
  const email = body.email?.trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const access = await checkBetaRegistrationAccess(admin, email);
    return NextResponse.json(access);
  } catch (error) {
    console.error("[beta/access] Failed", error);
    return NextResponse.json({ allowed: true, inviteOnly: false, isFull: false, waitlistEnabled: true });
  }
}
