import { NextResponse } from "next/server";
import { createApp } from "../../../../../apps/jarvis/lib/app.mjs";
import { validTwilioSignature } from "@/lib/ai-team/twilioWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jarvis = createApp({
  dataDir: process.env.JARVIS_DATA_DIR || (process.env.VERCEL === "1" ? "/tmp/jarvis" : undefined),
});

const EVENT_ID = /^[A-Za-z0-9._:-]{6,80}$/;

export async function POST(request: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return NextResponse.json({ error: "Voice is not configured." }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 16384) return NextResponse.json({ error: "Invalid payload." }, { status: 413 });
  const fields = Object.fromEntries(new URLSearchParams(raw));
  const origin = process.env.JARVIS_PUBLIC_ORIGIN;
  if (!origin || !/^https:\/\//.test(origin)) return NextResponse.json({ error: "Voice origin not configured." }, { status: 503 });
  const incoming = new URL(request.url);
  const canonicalUrl = new URL(`${incoming.pathname}${incoming.search}`, origin).toString();
  if (!validTwilioSignature(canonicalUrl, fields, request.headers.get("x-twilio-signature"), token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }
  const eventId = incoming.searchParams.get("event") ?? "";
  if (!EVENT_ID.test(eventId)) return NextResponse.json({ error: "Unknown call." }, { status: 404 });
  await jarvis.recordCallStatus(eventId, String(fields.CallStatus ?? ""));
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
