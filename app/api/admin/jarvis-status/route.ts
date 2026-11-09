import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";
const repo = "cgoller99/budgetos";
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const token = process.env.JARVIS_GITHUB_READ_TOKEN;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/jarvis-proposals.yml/runs?per_page=5`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const data = await res.json() as { workflow_runs?: Array<{ id: number; status: string; conclusion: string | null; created_at: string; html_url: string; event: string }> };
    const codingResponse = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/jarvis-coding-review.yml/runs?per_page=8`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store", signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    const codingData = codingResponse?.ok ? await codingResponse.json() as { workflow_runs?: Array<{ id: number; status: string; conclusion: string | null; created_at: string; html_url: string; event: string }> } : null;
    const normalize = (r: { id: number; status: string; conclusion: string | null; created_at: string; html_url: string; event: string }) =>
      ({ id: r.id, status: r.status, conclusion: r.conclusion, createdAt: r.created_at, url: r.html_url, event: r.event });
    return NextResponse.json({
      connected: true,
      runs: (data.workflow_runs ?? []).map(normalize),
      codingRuns: (codingData?.workflow_runs ?? []).map(normalize),
      codingStatusAvailable: Boolean(codingResponse?.ok),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ connected: false, reason: "GitHub workflow status unavailable", runs: [] }, { headers: { "Cache-Control": "no-store" } }); }
}
