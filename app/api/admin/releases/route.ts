import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  createRelease,
  listAllReleases,
} from "@/lib/admin/releaseService";
import type { CreateReleaseInput } from "@/lib/whatsNew/types";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const releases = await listAllReleases(auth.adminSupabase);
    return NextResponse.json({ releases });
  } catch (error) {
    console.error("[admin/releases] list failed", error);
    return NextResponse.json({ error: "Unable to load releases." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  let body: CreateReleaseInput;

  try {
    body = (await request.json()) as CreateReleaseInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.version?.trim() || !body.title?.trim() || !body.releaseDate) {
    return NextResponse.json(
      { error: "Version, title, and release date are required." },
      { status: 400 },
    );
  }

  try {
    const release = await createRelease(auth.adminSupabase, {
      ...body,
      changes: body.changes ?? [],
    });
    return NextResponse.json({ release });
  } catch (error) {
    console.error("[admin/releases] create failed", error);
    return NextResponse.json(
      { error: "Unable to create release." },
      { status: 500 },
    );
  }
}
