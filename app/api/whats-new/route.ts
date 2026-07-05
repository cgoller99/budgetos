import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPublishedReleases } from "@/lib/whatsNew/releaseService";
import type { ReleaseChangeCategory } from "@/lib/whatsNew/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await listPublishedReleases(supabase, {
      offset: Number(params.get("offset") ?? 0),
      limit: Number(params.get("limit") ?? 5),
      q: params.get("q") ?? undefined,
      category: (params.get("category") as ReleaseChangeCategory | null) ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[whats-new] list failed", error);
    return NextResponse.json(
      { error: "Unable to load release notes." },
      { status: 500 },
    );
  }
}
