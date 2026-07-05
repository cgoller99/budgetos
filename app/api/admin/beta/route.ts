import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  exportBetaUsersCsv,
  exportFeedbackCsv,
  getBetaDashboardMetrics,
  getBetaSettings,
  listBetaProfiles,
  listBetaWaitlist,
  updateBetaSettings,
  updateBetaWaitlistStatus,
  updateProfileBetaStatus,
} from "@/lib/admin/betaService";
import type { BetaUserStatus } from "@/lib/beta/types";

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;
  const view = params.get("view");

  try {
    if (view === "waitlist") {
      const status = params.get("status") as BetaUserStatus | null;
      const waitlist = await listBetaWaitlist(auth.adminSupabase, status ?? undefined);
      return NextResponse.json({ waitlist });
    }

    if (view === "users") {
      const status = params.get("status") as BetaUserStatus | null;
      const users = await listBetaProfiles(auth.adminSupabase, status ?? undefined);
      return NextResponse.json({ users });
    }

    if (view === "settings") {
      const settings = await getBetaSettings(auth.adminSupabase);
      return NextResponse.json({ settings });
    }

    const [metrics, settings] = await Promise.all([
      getBetaDashboardMetrics(auth.adminSupabase),
      getBetaSettings(auth.adminSupabase),
    ]);

    return NextResponse.json({ metrics, settings });
  } catch (error) {
    console.error("[admin/beta] Failed", error);
    return NextResponse.json({ error: "Unable to load beta dashboard." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    inviteOnly?: boolean;
    maxBetaUsers?: number | null;
    waitlistEnabled?: boolean;
    waitlistId?: string;
    waitlistStatus?: BetaUserStatus;
    userId?: string;
    betaStatus?: BetaUserStatus;
  };

  try {
    if (body.waitlistId && body.waitlistStatus) {
      await updateBetaWaitlistStatus(auth.adminSupabase, body.waitlistId, body.waitlistStatus);
    }

    if (body.userId && body.betaStatus) {
      await updateProfileBetaStatus(auth.adminSupabase, body.userId, body.betaStatus);
    }

    const settings = await updateBetaSettings(auth.adminSupabase, {
      inviteOnly: body.inviteOnly,
      maxBetaUsers: body.maxBetaUsers,
      waitlistEnabled: body.waitlistEnabled,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[admin/beta] PATCH failed", error);
    return NextResponse.json({ error: "Unable to update beta settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { exportType?: "users" | "feedback" };

  try {
    const csv =
      body.exportType === "feedback"
        ? await exportFeedbackCsv(auth.adminSupabase)
        : await exportBetaUsersCsv(auth.adminSupabase);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${body.exportType ?? "users"}-export.csv"`,
      },
    });
  } catch (error) {
    console.error("[admin/beta] export failed", error);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
