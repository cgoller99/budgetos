import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { parseJarvisExecutionLedger } from "@/lib/jarvis/executionLedger.mjs";
import manifest from "@/data/jarvis-approved-tasks.json";
export const dynamic = "force-dynamic";
const repo = "cgoller99/budgetos";
const ids = manifest.filter(t => t.status === "approved").map(t => t.id);

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const token = process.env.JARVIS_GITHUB_DISPATCH_TOKEN;
  if (!token) return NextResponse.json({ available: false, reason: "GitHub ledger credential not configured", executions: [] }, { headers: { "Cache-Control": "no-store" } });
  const all: unknown[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100&page=${page}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!response.ok) throw Error("GitHub ledger request failed");
      const issues: unknown = await response.json();
      if (!Array.isArray(issues)) throw Error("Unexpected GitHub response");
      all.push(...issues);
      if (issues.length < 100) break;
      if (page === 10) throw Error("Ledger scan limit exceeded");
    }
    const executions = parseJarvisExecutionLedger(all, ids);
    return NextResponse.json({ available: true, source: "github_issue_ledger", executions, caveat: "Issue ledger records worker claims; verify workflow artifact for execution evidence. Saved Jarvis chat tasks are not automatically approved or executed." }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ available: false, reason: "GitHub execution ledger unavailable", executions: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
