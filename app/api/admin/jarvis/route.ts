import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";

export const dynamic = "force-dynamic";

type Commit = { sha: string; commit: { message: string; author: { date: string } | null }; html_url: string };

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const token = process.env.JARVIS_GITHUB_READ_TOKEN;
  if (!token) {
    return NextResponse.json({
      connected: false,
      reason: "GitHub telemetry token not configured. Local Jarvis queue and journal are not synced to this server.",
      commits: [],
      workerOnline: null,
      queueConnected: false,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await fetch(
      "https://api.github.com/repos/cgoller99/budgetos/commits?sha=jarvis%2Fintegrate-20261105&per_page=5",
      {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const commits = (await response.json() as Commit[]).map((commit) => ({
      sha: commit.sha.slice(0, 7),
      message: commit.commit.message.split("\n")[0].slice(0, 160),
      at: commit.commit.author?.date ?? null,
      url: commit.html_url,
    }));
    return NextResponse.json({ connected: true, commits, workerOnline: null, queueConnected: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ connected: false, reason: "GitHub development activity is temporarily unavailable.", commits: [], workerOnline: null, queueConnected: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
