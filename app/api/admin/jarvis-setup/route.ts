import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const token = process.env.JARVIS_GITHUB_DISPATCH_TOKEN?.trim();
  const checks: Array<{ name: string; state: "ready" | "missing" | "unverified"; detail: string }> = [
    { name: "GitHub dispatch credential", state: token ? "unverified" : "missing", detail: token ? "Configured; checking GitHub permission" : "Set JARVIS_GITHUB_DISPATCH_TOKEN in Vercel server environment" },
    { name: "AI Gateway for GitHub worker", state: "unverified", detail: "AI_GATEWAY_API_KEY must be a GitHub Actions environment secret; Vercel cannot verify it" },
    { name: "Protected coding environment", state: "unverified", detail: "Confirm jarvis-coding exists with required reviewers in GitHub Settings" },
  ];
  if (token) {
    try {
      const result = await fetch("https://api.github.com/repos/cgoller99/budgetos/actions/workflows/jarvis-coding-review.yml", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      checks[0] = { name: "GitHub dispatch credential", state: result.ok ? "ready" : "unverified", detail: result.ok ? "Workflow accessible; dispatch permission not yet tested" : "GitHub workflow access could not be verified" };
    } catch {
      checks[0] = { name: "GitHub dispatch credential", state: "unverified", detail: "GitHub connection unavailable" };
    }
  }
  return NextResponse.json({ checks, canVerifyEndToEnd: false, mode: "review_only" }, { headers: { "Cache-Control": "no-store" } });
}
