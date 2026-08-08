import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  APP_REVIEW_TARGET_EMAIL,
  seedAppReviewAccount,
} from "@/lib/admin/seedAppReviewAccount";

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  let dryRun = false;
  try {
    const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
    dryRun = Boolean(body.dryRun);
  } catch {
    dryRun = false;
  }

  try {
    const result = await seedAppReviewAccount(auth.adminSupabase, {
      email: APP_REVIEW_TARGET_EMAIL,
      dryRun,
    });

    return NextResponse.json({
      ok: true,
      result,
      message: dryRun
        ? "Dry run complete. No rows were written."
        : "App Review demo seed complete for the locked target account.",
    });
  } catch (error) {
    console.error("[admin/seed-app-review] Failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to seed App Review account.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  return NextResponse.json({
    targetEmail: APP_REVIEW_TARGET_EMAIL,
    description:
      "POST to seed idempotent App Review demo data. Never modifies subscription fields. Locked to a single email.",
  });
}
