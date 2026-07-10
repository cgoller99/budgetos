import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  getAdminIncomeDiagnostics,
  refreshAdminIncomeDiagnostics,
} from "@/lib/admin/incomeDiagnosticsService";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;

  try {
    const result = await getAdminIncomeDiagnostics(auth.adminSupabase, userId);

    if (!result) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/users/:id/income-diagnostics] Failed", error);
    return NextResponse.json(
      { error: "Unable to load income diagnostics." },
      { status: 500 },
    );
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;

  try {
    const result = await refreshAdminIncomeDiagnostics(
      auth.adminSupabase,
      userId,
    );

    if (!result) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      ...result,
      refreshed: true,
    });
  } catch (error) {
    console.error("[admin/users/:id/income-diagnostics] Refresh failed", error);
    return NextResponse.json(
      { error: "Unable to refresh income diagnostics." },
      { status: 500 },
    );
  }
}
