import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  deleteRelease,
  publishRelease,
  unpublishRelease,
  updateRelease,
} from "@/lib/admin/releaseService";
import type { UpdateReleaseInput } from "@/lib/whatsNew/types";

type RouteContext = {
  params: Promise<{ releaseId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { releaseId } = await context.params;
  let body: UpdateReleaseInput & { action?: "publish" | "unpublish" };

  try {
    body = (await request.json()) as UpdateReleaseInput & {
      action?: "publish" | "unpublish";
    };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    if (body.action === "publish") {
      const release = await publishRelease(auth.adminSupabase, releaseId);
      return NextResponse.json({ release });
    }

    if (body.action === "unpublish") {
      const release = await unpublishRelease(auth.adminSupabase, releaseId);
      return NextResponse.json({ release });
    }

    const { action: _action, ...input } = body;
    const release = await updateRelease(auth.adminSupabase, releaseId, input);
    return NextResponse.json({ release });
  } catch (error) {
    console.error("[admin/releases] update failed", error);
    return NextResponse.json({ error: "Unable to update release." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { releaseId } = await context.params;

  try {
    await deleteRelease(auth.adminSupabase, releaseId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/releases] delete failed", error);
    return NextResponse.json({ error: "Unable to delete release." }, { status: 500 });
  }
}
