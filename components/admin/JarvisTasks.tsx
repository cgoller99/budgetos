"use client";
import { useEffect, useState } from "react";
type Run = { id: string; goal: string; created_at: string; ai_team_tasks: Array<{ id: string; title: string; status: string; requires_approval: boolean }> };
export function JarvisTasks() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/jarvis-tasks", { cache: "no-store" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unavailable"); setRuns(d.runs ?? []); }).catch(e => setError(e instanceof Error ? e.message : "Tasks could not be loaded")).finally(() => setLoading(false)); }, []);
  return <article className="rounded-2xl border border-white/10 bg-slate-900 p-6"><h2 className="text-lg font-semibold">Founder task queue</h2><p className="mt-2 text-sm text-slate-400">Tasks you have saved for Jarvis. Review requests appear in Approvals.</p>{error && <p role="alert" className="mt-3 text-amber-300">{error}</p>}{loading && <p role="status" className="mt-4 text-sm text-slate-400">Loading saved tasks…</p>}{runs.length === 0 && !error && !loading && <p className="mt-4 text-sm text-slate-400">No saved tasks. Open Chat and choose Save as task.</p>}<div className="mt-4 space-y-3">{runs.flatMap(r => r.ai_team_tasks.map(t => <div key={t.id} className="rounded-xl border border-white/10 p-4"><p className="font-medium">{t.title}</p><p className="mt-2 text-xs text-blue-300">{t.status.replaceAll("_", " ")} · {new Date(r.created_at).toLocaleString()}</p></div>))}</div></article>;
}
