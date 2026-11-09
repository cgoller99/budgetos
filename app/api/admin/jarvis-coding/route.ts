import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";

/** Explicit founder approval is required for every isolated coding review run. */
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const body = payload && typeof payload === "object" ? payload as { task?: unknown; approved?: unknown } : {};
  if (body.approved !== true) return NextResponse.json({ error: "Explicit approval is required." }, { status: 403 });
  const task = body.task;
  if (typeof task !== "string" || task.trim().length < 3 || task.trim().length > 500 || /[\r\n]/.test(task)) return NextResponse.json({ error: "Task must be 3–500 characters on one line." }, { status: 400 });
  const token = process.env.JARVIS_GITHUB_DISPATCH_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "GitHub dispatch credential is not configured." }, { status: 503 });
  try {
    const result = await fetch("https://api.github.com/repos/cgoller99/budgetos/actions/workflows/jarvis-coding-review.yml/dispatches", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { task: task.trim(), approved: "true" } }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!result.ok) {
      console.error("Jarvis coding dispatch failed", result.status);
      return NextResponse.json({ error: result.status === 401 || result.status === 403 ? "GitHub Actions token permission denied." : "GitHub Actions rejected the coding review." }, { status: 502 });
    }
    return NextResponse.json({ queued: true, mode: "coding_review_only", codeGenerated: false, deployed: false }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "GitHub Actions connection failed." }, { status: 502 }); }
}
