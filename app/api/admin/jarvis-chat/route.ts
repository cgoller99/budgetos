import { NextResponse } from "next/server";
import { generateText } from "ai";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { isAiTeamModelRuntimeAvailable } from "@/lib/ai-team/modelRuntime";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const raw = body && typeof body === "object" ? (body as { messages?: unknown }).messages : undefined;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
  const messages = raw.map((m: unknown) => {
    if (!m || typeof m !== "object") return null;
    const item = m as { role?: unknown; content?: unknown };
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string" || item.content.length > 3000) return null;
    return { role: item.role, content: item.content };
  });
  if (messages.some(m => !m) || messages[messages.length - 1]?.role !== "user") return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  if (!isAiTeamModelRuntimeAvailable()) return NextResponse.json({ error: "Jarvis conversation AI is not configured yet. Worker activity is available in the Activity tab." }, { status: 503 });
  try {
    const result = await generateText({
      model: process.env.JARVIS_CHAT_MODEL?.trim() || "openai/gpt-4o-mini",
      system: "You are Jarvis, the Buxme founder's operational assistant. Speak directly and concisely. You can discuss plans and propose tasks, but this chat cannot execute code, send messages, spend money, modify subscriptions, or access private customer records. Never claim to have performed an action or checked live data unless the user supplied proof. For production, payments, authentication, banking, customer data, and outreach, require explicit approval. Do not reveal secrets. Be transparent about what is not connected.",
      messages: messages as Array<{ role: "user" | "assistant"; content: string }>,
      maxOutputTokens: 650,
      abortSignal: AbortSignal.timeout(25000),
    });
    return NextResponse.json({ reply: result.text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
    console.error("Jarvis chat model failure", { name: error instanceof Error ? error.name : "Unknown", status, message: message.slice(0, 250) });
    const guidance = status === 401 || status === 403 ? "Jarvis AI authentication is not authorized. Configure Vercel AI Gateway." :
      status === 402 ? "Jarvis AI Gateway billing or spending limit is blocking replies." :
      status === 404 ? "Jarvis AI model is unavailable. Check the configured model." :
      status === 429 ? "Jarvis AI request limit reached. Try again shortly." :
      /timeout|abort/i.test(message) ? "Jarvis AI timed out. Try again." :
      "Jarvis AI request failed. Check AI Gateway model access and billing in Vercel.";
    return NextResponse.json({ error: guidance }, { status: 502 });
  }
}
