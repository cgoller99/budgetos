import { NextResponse } from "next/server";
import { jarvisIntroTwiML, validTwilioSignature } from "@/lib/ai-team/twilioWebhook";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return NextResponse.json({ error: "Voice is not configured." }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 16384) return NextResponse.json({ error: "Invalid payload." }, { status: 413 });
  const fields = Object.fromEntries(new URLSearchParams(raw));
  const origin = process.env.JARVIS_PUBLIC_ORIGIN;
  if (!origin || !/^https:\/\//.test(origin)) return NextResponse.json({ error: "Voice origin not configured." }, { status: 503 });
  const canonicalUrl = new URL(new URL(request.url).pathname, origin).toString();
  if (!validTwilioSignature(canonicalUrl, fields, request.headers.get("x-twilio-signature"), token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }
  return new Response(jarvisIntroTwiML(), { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" } });
}
