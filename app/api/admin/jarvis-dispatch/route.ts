import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const token = process.env.JARVIS_GITHUB_DISPATCH_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "Worker not connected. Configure JARVIS_GITHUB_DISPATCH_TOKEN in Vercel with GitHub Actions write permission." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const goal = body && typeof body === "object" ? (body as { goal?: unknown }).goal : undefined;
  if (typeof goal !== "string" || goal.trim().length < 3 || goal.trim().length > 500 || /[\r\n]/.test(goal)) return NextResponse.json({ error: "Task must be 3–500 characters on one line" }, { status: 400 });
  try {
    const response = await fetch("https://api.github.com/repos/cgoller99/budgetos/actions/workflows/jarvis-proposals.yml/dispatches", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { founder_task: goal.trim() } }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Jarvis worker dispatch failed", { status: response.status });
      return NextResponse.json({ error: response.status === 401 || response.status === 403 ? "GitHub token lacks workflow permission." : "GitHub did not accept the worker task." }, { status: 502 });
    }
    return NextResponse.json({ queued: true, workflow: "jarvis-proposals.yml", mode: "proposal_only", executed: false }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach GitHub Actions." }, { status: 502 });
  }
}
