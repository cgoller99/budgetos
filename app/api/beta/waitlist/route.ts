import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

type WaitlistBody = {
  email?: string;
  fullName?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as WaitlistBody;
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();

    const { data: settings } = await admin
      .from("beta_settings")
      .select("waitlist_enabled, invite_only, max_beta_users")
      .eq("id", 1)
      .maybeSingle();

    if (settings?.waitlist_enabled === false) {
      return NextResponse.json({ error: "Beta waitlist is closed." }, { status: 403 });
    }

    const { count: approvedCount } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("beta_status", "approved");

    if (
      settings?.max_beta_users &&
      (approvedCount ?? 0) >= settings.max_beta_users
    ) {
      return NextResponse.json(
        { error: "Beta is full. Join the waitlist and we will notify you.", full: true },
        { status: 409 },
      );
    }

    const { error } = await admin.from("beta_waitlist").insert({
      email,
      full_name: fullName || null,
      status: "pending",
      source: "beta_page",
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: true, message: "You are already on the waitlist." });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      analyticsEvent: ANALYTICS_EVENTS.BETA_WAITLIST_JOINED,
    });
  } catch (error) {
    console.error("[beta/waitlist] Failed", error);
    return NextResponse.json({ error: "Unable to join waitlist." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("beta_settings")
      .select("invite_only, max_beta_users, waitlist_enabled")
      .eq("id", 1)
      .maybeSingle();

    const { count: approvedCount } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("beta_status", "approved");

    const max = data?.max_beta_users ?? null;
    const isFull = Boolean(max && (approvedCount ?? 0) >= max);

    return NextResponse.json({
      inviteOnly: data?.invite_only ?? false,
      waitlistEnabled: data?.waitlist_enabled ?? true,
      maxBetaUsers: max,
      approvedCount: approvedCount ?? 0,
      isFull,
    });
  } catch {
    return NextResponse.json({
      inviteOnly: false,
      waitlistEnabled: true,
      maxBetaUsers: null,
      approvedCount: 0,
      isFull: false,
    });
  }
}
