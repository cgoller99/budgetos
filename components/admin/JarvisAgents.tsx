"use client";
import { useCallback, useEffect, useState } from "react";

type AgentName = "developer" | "marketing" | "analytics" | "operations";
type Task = { id: string; title: string; status: string; requires_approval: boolean; agent: AgentName | null; risk: string; created_at: string };
type Payload = { agentTasks: Task[]; mode: string; workers: Record<AgentName, { label: string; approval: string }> };
const names: AgentName[] = ["developer", "marketing", "analytics", "operations"];

export function JarvisAgents({ approvalsOnly = false }: { approvalsOnly?: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [targetFiles, setTargetFiles] = useState<Record<string, string>>({});
  const [approvedTask, setApprovedTask] = useState<string | null>(null);
  const [dispatchingTask, setDispatchingTask] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/jarvis-tasks", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Agent task data unavailable");
      setData(json); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Agent task data unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function requestDeveloperPatch(task: Task) {
    if (dispatchingTask || approvedTask !== task.id) return;
    setDispatchingTask(task.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/jarvis-coding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, targetFile: (targetFiles[task.id] ?? "").trim(), approved: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not dispatch task");
      setApprovedTask(null);
      setNotice("Developer patch proposal queued for review. No code was applied or deployed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Dispatch failed"); }
    finally { setDispatchingTask(null); }
  }
  const tasks = data?.agentTasks ?? [];
  const awaiting = tasks.filter(t => !["completed", "done", "cancelled", "canceled", "rejected", "failed"].includes(t.status) && (t.requires_approval || t.status === "needs_approval"));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">{approvalsOnly ? "Approval inbox" : "Specialist agents"}</h2><p className="mt-1 text-sm text-slate-400">Shared Supabase task records · review only · no automatic execution</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    {notice && <p role="status" className="rounded-xl border border-blue-500/30 p-3 text-sm text-blue-200">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-amber-500/40 p-3 text-sm text-amber-300">{error}</p>}
    {!approvalsOnly && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {names.map(name => {
        const count = tasks.filter(t => t.agent === name).length;
        return <article key={name} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-widest text-blue-300">{name}</p>
          <p className="mt-3 text-3xl font-semibold">{count}</p>
          <p className="mt-1 text-xs text-slate-400">Assigned proposals</p>
          <p className="mt-3 text-xs text-slate-500">{data?.workers?.[name]?.approval ?? "Actions require review"}</p>
        </article>;
      })}
    </div>}
    <article className="rounded-2xl border border-white/10 bg-slate-900 p-5">
      <h3 className="font-semibold">{approvalsOnly ? "Requests requiring approval" : "Shared task queue"}</h3>
      <p className="mt-1 text-xs text-slate-400">{approvalsOnly ? awaiting.length : tasks.length} task(s) · No task is being executed by this dashboard</p>
      <div className="mt-4 space-y-3">
        {(approvalsOnly ? awaiting : tasks).map(t => <div key={t.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{t.title}</p><span className="rounded-lg border border-white/20 px-2 py-1 text-xs text-blue-200">{t.agent ?? "Needs triage"}</span></div>
          {t.agent === "developer" && t.risk === "review_required" && t.status === "needs_approval" && <div className="mt-3 space-y-2">
            <input aria-label={"Target file for " + t.title} value={targetFiles[t.id] ?? ""} onChange={e => setTargetFiles(prev => ({ ...prev, [t.id]: e.target.value }))} placeholder="components/example.tsx" className="w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={approvedTask === t.id} onChange={e => setApprovedTask(e.target.checked ? t.id : null)} />I approve an isolated AI patch proposal for this task and file</label>
            <button type="button" disabled={dispatchingTask !== null || approvedTask !== t.id || !(targetFiles[t.id] ?? "").trim()} onClick={() => void requestDeveloperPatch(t)} className="rounded-lg border border-blue-500 px-3 py-2 text-xs font-semibold disabled:opacity-40">{dispatchingTask === t.id ? "Requesting…" : "Request developer patch"}</button>
          </div>}
          <p className="mt-2 text-xs text-slate-400">{t.status.replaceAll("_", " ")} · {t.risk.replaceAll("_", " ")} · {new Date(t.created_at).toLocaleString()}</p>
        </div>)}
        {!loading && (approvalsOnly ? awaiting : tasks).length === 0 && <p className="text-sm text-slate-400">{approvalsOnly ? "Nothing is waiting for your approval." : "No tasks yet. Save a task from Jarvis Chat to get started."}</p>}
      </div>
    </article>
  </div>;
}
