import { NextResponse } from "next/server";
import { checkSupabaseRlsHealth } from "@/lib/supabase/rlsHealthCheck";

export const runtime = "nodejs";

export async function GET() {
  const health = await checkSupabaseRlsHealth();

  return NextResponse.json(
    {
      ok: health.configured && health.allRequiredTablesProtected,
      service: "supabase-rls-health",
      ...health,
    },
    { status: health.configured ? 200 : 503 },
  );
}
