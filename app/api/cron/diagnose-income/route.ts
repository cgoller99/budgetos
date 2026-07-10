import { NextResponse } from "next/server";
import { getAdminIncomeDiagnostics } from "@/lib/admin/incomeDiagnosticsService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV === "development" && !process.env.VERCEL;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(request.url).searchParams.get("userId")?.trim();
  const email = new URL(request.url).searchParams.get("email")?.trim();

  if (!userId && !email) {
    return NextResponse.json(
      { error: "Provide userId or email query parameter." },
      { status: 400 },
    );
  }

  try {
    const adminSupabase = createSupabaseAdminClient();
    let resolvedUserId = userId;

    if (!resolvedUserId && email) {
      const { data, error } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (error) {
        throw error;
      }

      const match = data.users.find(
        (user) => user.email?.toLowerCase() === email.toLowerCase(),
      );

      if (!match) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      resolvedUserId = match.id;
    }

    const result = await getAdminIncomeDiagnostics(
      adminSupabase,
      resolvedUserId!,
    );

    if (!result) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/diagnose-income] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to diagnose income.",
      },
      { status: 500 },
    );
  }
}
