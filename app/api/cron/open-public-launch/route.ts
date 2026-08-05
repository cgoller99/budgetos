import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.OPEN_PUBLIC_LAUNCH_SECRET?.trim();
  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * One-shot public launch helper.
 * Sets invite_only=false and waitlist_enabled=false.
 * Requires OPEN_PUBLIC_LAUNCH_SECRET (remove after use).
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("beta_settings")
      .update({
        invite_only: false,
        waitlist_enabled: false,
        max_beta_users: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("invite_only, waitlist_enabled, max_beta_users, updated_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      settings: {
        inviteOnly: data?.invite_only ?? false,
        waitlistEnabled: data?.waitlist_enabled ?? false,
        maxBetaUsers: data?.max_beta_users ?? null,
        updatedAt: data?.updated_at ?? null,
      },
    });
  } catch (error) {
    console.error("[open-public-launch] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to open public launch settings.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
