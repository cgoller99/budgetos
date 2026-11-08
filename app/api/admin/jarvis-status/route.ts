import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";
const repo = "cgoller99/budgetos";
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const token = process.env.JARVIS_GITHUB_READ_TOKEN;
  if (!token) return NextResponse.json({ connected: false, reason: "GitHub read token not configured", runs: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/jarvis-proposals.yml/runs?per_page=5`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const data = await res.json() as { workflow_runs?: Array<{ id: number; status: string; conclusion: string | null; created_at: string; html_url: string; event: string }> };
    return NextResponse.json({ connected: true, runs: (data.workflow_runs ?? []).map(r => ({ id: r.id, status: r.status, conclusion: r.conclusion, createdAt: r.created_at, url: r.html_url, event: r.event })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ connected: false, reason: "GitHub workflow status unavailable", runs: [] }, { headers: { "Cache-Control": "no-store" } }); }
}
