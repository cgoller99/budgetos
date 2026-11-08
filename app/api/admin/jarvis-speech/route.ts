import { NextResponse } from "next/server";
import { generateSpeech } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const text = body && typeof body === "object" ? (body as { text?: unknown }).text : null;
  if (typeof text !== "string" || !text.trim() || text.length > 2400) return NextResponse.json({ error: "Invalid speech text" }, { status: 400 });
  try {
    // Vercel deployment OIDC authenticates AI Gateway without an OpenAI API key.
    const result = await generateSpeech({
      model: gateway.speechModel("openai/gpt-4o-mini-tts"),
      text,
      voice: "onyx",
      instructions: "A composed, confident British male AI butler. Warm low baritone, refined English accent, measured pace, crisp articulation, subtle dry wit. Natural conversational delivery. Do not imitate a specific actor or character.",
      outputFormat: "mp3",
      abortSignal: AbortSignal.timeout(20000),
      maxRetries: 0,
    });
    return new Response(new Uint8Array(result.audio.uint8Array), { headers: { "Content-Type": result.audio.mediaType || "audio/mpeg", "Cache-Control": "no-store", "X-Jarvis-Voice": "neural-gateway" } });
  } catch (error) {
    console.error("Jarvis gateway speech failed", { name: error instanceof Error ? error.name : "unknown", message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return NextResponse.json({ error: "Neural voice temporarily unavailable; check AI Gateway audio model access and spending controls." }, { status: 502 });
  }
}