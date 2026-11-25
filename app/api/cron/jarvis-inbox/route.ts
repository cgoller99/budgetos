import { createApp } from "../../../../apps/jarvis/lib/app.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jarvis = createApp({
  dataDir: process.env.JARVIS_DATA_DIR || (process.env.VERCEL === "1" ? "/tmp/jarvis" : undefined),
});

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the reply as JSON." }, { status: 400 });
  }
  try {
    const result = await jarvis.ingest(body) as { created: boolean; duplicate: boolean; draft: { id: string } | null } | null;
    if (!result) return Response.json({ error: "Inbox did not record the reply." }, { status: 500 });
    return Response.json({
      created: result.created,
      duplicate: result.duplicate,
      draftId: result.draft?.id ?? null,
      sent: false,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Inbox failed." }, { status });
  }
}
