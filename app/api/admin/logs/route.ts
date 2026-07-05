import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { listAdminEventLogs } from "@/lib/admin/healthService";

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const eventTypeParam = new URL(request.url).searchParams.get("type");
  const eventType =
    eventTypeParam === "error" ||
    eventTypeParam === "stripe" ||
    eventTypeParam === "plaid" ||
    eventTypeParam === "auth" ||
    eventTypeParam === "api_failure"
      ? eventTypeParam
      : undefined;

  try {
    const logs = await listAdminEventLogs(auth.adminSupabase, eventType);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[admin/logs] Failed", error);
    return NextResponse.json({ error: "Unable to load logs." }, { status: 500 });
  }
}
