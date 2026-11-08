import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Neural voice not configured; browser voice available." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const text = body && typeof body === "object" ? (body as { text?: unknown }).text : null;
  if (typeof text !== "string" || !text.trim() || text.length > 2400) return NextResponse.json({ error: "Invalid speech text" }, { status: 400 });
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "onyx",
        input: text,
        response_format: "mp3",
        instructions: "A composed, confident British male AI butler. Refined English accent, warm baritone, measured pace, crisp articulation, subtle dry wit. Professional and natural, never cartoonish. Do not imitate a specific actor or character's distinctive voice.",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.error("Jarvis neural speech failed", response.status);
      return NextResponse.json({ error: "Neural speech unavailable; using browser voice." }, { status: 502 });
    }
    return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Neural speech timed out; using browser voice." }, { status: 502 });
  }
}
