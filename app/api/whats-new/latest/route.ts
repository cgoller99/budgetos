import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getLatestPublishedRelease,
  hasUserSeenRelease,
} from "@/lib/whatsNew/releaseService";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const release = await getLatestPublishedRelease(supabase);

    if (!release) {
      return NextResponse.json({ release: null, seen: true });
    }

    const seen = await hasUserSeenRelease(supabase, user.id, release.id);

    return NextResponse.json({ release, seen });
  } catch (error) {
    console.error("[whats-new/latest] failed", error);
    return NextResponse.json(
      { error: "Unable to load latest release." },
      { status: 500 },
    );
  }
}
