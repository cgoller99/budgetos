import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAdminSystemHealth } from "@/lib/admin/healthService";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const health = await getAdminSystemHealth(auth.adminSupabase);
    return NextResponse.json({ checks: health });
  } catch (error) {
    console.error("[admin/health] Failed", error);
    return NextResponse.json({ error: "Unable to load system health." }, { status: 500 });
  }
}
