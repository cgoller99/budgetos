import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  getAdminUserDetail,
  performAdminUserAction,
  type AdminUserAction,
} from "@/lib/admin/userService";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;

  try {
    const user = await getAdminUserDetail(auth.adminSupabase, userId);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[admin/users/:id] Failed", error);
    return NextResponse.json({ error: "Unable to load user." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { userId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: AdminUserAction };
  const action = body.action;

  if (!action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    await performAdminUserAction({
      adminSupabase: auth.adminSupabase,
      actor: auth.user,
      userId,
      action,
    });

    const user = await getAdminUserDetail(auth.adminSupabase, userId);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[admin/users/:id] Action failed", error);
    const message = error instanceof Error ? error.message : "Action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
