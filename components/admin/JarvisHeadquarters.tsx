"use client";

import { useCallback, useEffect, useState } from "react";
import { JarvisChat } from "./JarvisChat";
import { JarvisTasks } from "./JarvisTasks";
import { JarvisAgents } from "./JarvisAgents";
import { JarvisSetup } from "./JarvisSetup";

type Section = "Home" | "Tasks" | "Approvals" | "Activity" | "Chat" | "Team" | "Setup";
type WorkflowRun = { id: number; status: string; conclusion: string | null; createdAt: string; url: string };
type Finding = { number: number; title: string; status: string; agent?: string; url: string };
type Worker = {
  connected: boolean;
  reason?: string;
  runs: WorkflowRun[];
  codingRuns?: WorkflowRun[];
  codingStatusAvailable?: boolean;
  autonomousQueueAvailable?: boolean;
  autonomousTasks?: Finding[];
};
type Task = { id: string; title: string; status: string; requires_approval: boolean; created_at: string };
const navigation: Section[] = ["Home", "Tasks", "Approvals", "Activity"];
const panel = "rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-6";
const secondaryButton = "min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 disabled:opacity-50";
const terminalTaskStates = new Set(["completed", "done", "cancelled", "canceled", "rejected", "failed"]);
const activeRunStates = new Set(["queued", "in_progress", "pending", "requested", "waiting"]);

function runLabel(run: WorkflowRun) {
  if (run.status === "waiting") return "Waiting for approval";
  if (run.status === "in_progress") return "Running";
  if (run.conclusion === "success") return "Review ready";
  if (run.conclusion === "failure") return "Needs attention";
  return (run.conclusion ?? run.status).replaceAll("_", " ");
}

export function JarvisHeadquarters() {
  const [section, setSection] = useState<Section>("Home");
  const [worker, setWorker] = useState<Worker | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [taskError, setTaskError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    const status = fetch("/api/admin/jarvis-status", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Status unavailable"); return response.json(); })
      .then((data: Worker) => { if (!controller.signal.aborted) setWorker(data); })
      .catch(() => { if (!controller.signal.aborted) setWorker({ connected: false, reason: "Worker status could not be loaded. Try refreshing or check setup.", runs: [] }); });
    const queue = fetch("/api/admin/jarvis-tasks", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Tasks unavailable"); return response.json(); })
      .then((data: { agentTasks?: Task[] }) => { if (!controller.signal.aborted) { setTasks(data.agentTasks ?? []); setTaskError(false); } })
      .catch(() => { if (!controller.signal.aborted) { setTasks(null); setTaskError(true); } });
    void Promise.allSettled([status, queue]).then(() => { if (!controller.signal.aborted) setRefreshing(false); });
    return () => controller.abort();
  }, [revision]);

  const pending = tasks?.filter(task => !terminalTaskStates.has(task.status) && (task.requires_approval || task.status === "needs_approval"));
  const completed = tasks?.filter(task => task.status === "completed" || task.status === "done");
  const activity = [
    ...(worker?.codingStatusAvailable ? worker.codingRuns ?? [] : []).map(run => ({ ...run, kind: "Coding review" })),
    ...(worker?.connected ? worker.runs : []).map(run => ({ ...run, kind: "Priority check" })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const active = activity.filter(run => activeRunStates.has(run.status));
  const activeCount = worker?.connected && worker.codingStatusAvailable ? String(active.length) : "—";
  const isSecondary = !navigation.includes(section);

  function show(next: Section) {
    setSection(next);
    refresh();
  }

  function findingList() {
    return <article className={panel}>
      <h2 className="text-lg font-semibold">Findings to review</h2>
      <p className="mt-1 text-sm text-slate-400">Issues Jarvis has found for Buxme.</p>
      {worker === null ? <p role="status" className="mt-4 text-sm text-slate-400">Loading findings…</p>
        : !worker.autonomousQueueAvailable ? <p className="mt-4 text-sm text-amber-200">Findings are unavailable. Check the connection in Setup.</p>
        : !worker.autonomousTasks?.length ? <p className="mt-4 text-sm text-slate-400">No findings yet.</p>
        : <div className="mt-4 divide-y divide-white/10">{worker.autonomousTasks.map(finding => <a key={finding.number} href={finding.url} target="_blank" rel="noopener noreferrer" className="block py-4 text-sm hover:text-blue-300">
          <p className="font-medium">{finding.title}</p><p className="mt-1 text-xs text-slate-400">#{finding.number} · {finding.status === "completed" ? "Completed" : "Awaiting review"}</p>
        </a>)}</div>}
    </article>;
  }

  return <div className="mx-auto max-w-5xl px-4 py-7 text-white sm:px-6 sm:py-10">
    <header className="mb-7 flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-blue-400">Buxme · Jarvis</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{section === "Home" ? "Here’s where things stand." : section}</h1>
        <p className="mt-2 text-sm text-slate-400">{section === "Home" ? "Your attention first. The details when you need them." : "Your Buxme workspace."}</p>
      </div>
      <button type="button" onClick={() => show("Setup")} aria-current={section === "Setup" ? "page" : undefined} className={secondaryButton}>Setup</button>
    </header>

    <nav aria-label="Jarvis sections" className="mb-7 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-slate-950/60 p-1">
      {navigation.map(item => <button type="button" key={item} onClick={() => show(item)} aria-current={section === item ? "page" : undefined} className={`min-h-11 rounded-xl px-2 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${section === item ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item}</button>)}
    </nav>
    {isSecondary && <button type="button" onClick={() => show("Home")} className={`${secondaryButton} mb-5`}>← Back to overview</button>}

    {section === "Home" && <div className="space-y-5">
      <article className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-950/70 to-slate-900 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Needs your attention</p>
            <h2 className="mt-3 text-xl font-semibold">{worker === null ? "Checking your workspace…" : !worker.connected ? "Finish connecting Jarvis" : taskError ? "Your task queue couldn’t load" : pending === undefined ? "Checking your tasks…" : pending.length ? `${pending.length} ${pending.length === 1 ? "task needs" : "tasks need"} your review` : "No tasks waiting for your approval"}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{worker && !worker.connected ? "Open Setup to see what is missing. Saved tasks stay available while the worker is disconnected." : taskError ? "Refresh to try again. Task counts will appear when the connection recovers." : "Review a proposal, check progress, or give Jarvis a new task."}</p>
          </div>
          {worker && !worker.connected ? <button type="button" onClick={() => show("Setup")} className="min-h-11 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">Continue setup</button>
            : pending && pending.length > 0 ? <button type="button" onClick={() => show("Approvals")} className="min-h-11 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">Review tasks</button>
            : <button type="button" onClick={() => show("Chat")} className="min-h-11 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">Talk to Jarvis</button>}
        </div>
      </article>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Awaiting review", value: pending === undefined ? "—" : String(pending.length), detail: "Saved tasks", target: "Approvals" as Section },
          { label: "Active runs", value: activeCount, detail: "Queued or running", target: "Activity" as Section },
          { label: "Completed", value: completed === undefined ? "—" : String(completed.length), detail: "Saved tasks", target: "Tasks" as Section },
        ].map(card => <button key={card.label} type="button" onClick={() => show(card.target)} className="min-h-32 rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-left transition hover:border-blue-400/40 focus-visible:outline-2 focus-visible:outline-blue-400 sm:p-5">
          <span className="text-xs text-slate-300 sm:text-sm">{card.label}</span><span className="my-2 block text-3xl font-semibold">{card.value}</span><span className="text-xs text-slate-500">{card.detail}</span>
        </button>)}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <article className={panel}><h2 className="text-lg font-semibold">Recent work</h2>
          {tasks === null ? <p className="mt-4 text-sm text-slate-400">{taskError ? "Your saved tasks are unavailable. Try refreshing." : "Loading saved tasks…"}</p>
            : !tasks.length ? <div className="mt-4"><p className="text-sm text-slate-400">Start with one thing you want done.</p><button type="button" onClick={() => show("Chat")} className={`${secondaryButton} mt-4`}>Give Jarvis a task</button></div>
            : <div className="mt-3 divide-y divide-white/10">{[...tasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4).map(task => <button key={task.id} type="button" onClick={() => show(!terminalTaskStates.has(task.status) && (task.requires_approval || task.status === "needs_approval") ? "Approvals" : "Tasks")} className="block w-full py-4 text-left text-sm hover:text-blue-300"><span className="block font-medium">{task.title}</span><span className="mt-1 block text-xs text-slate-400">{task.status.replaceAll("_", " ")}</span></button>)}</div>}
        </article>
        <article className={panel}><h2 className="text-lg font-semibold">Worker connection</h2>
          <div className="mt-4 flex items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${worker === null ? "bg-slate-500" : worker.connected ? "bg-blue-400" : "bg-amber-400"}`} /><p className="text-sm">{worker === null ? "Checking connection…" : worker.connected ? "Workflow status connected" : "Connection needs attention"}</p></div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{worker?.connected ? "A successful coding run produces a patch for review. It does not mean the change has shipped." : worker?.reason ?? "Checking recent workflow activity."}</p>
          {activity[0] && <p className="mt-3 text-xs text-slate-300">Latest: {activity[0].kind} · {runLabel(activity[0])}</p>}
          <button type="button" onClick={() => show(worker?.connected ? "Activity" : "Setup")} className={`${secondaryButton} mt-4`}>{worker?.connected ? "View activity" : "Check setup"}</button>
        </article>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-slate-500">
        <p role="status">{refreshing ? "Refreshing workspace…" : "Overview uses your latest saved tasks and workflow results."}</p>
        <div className="flex gap-2"><button type="button" onClick={() => show("Team")} className={secondaryButton}>View team</button><button type="button" onClick={refresh} disabled={refreshing} className={secondaryButton}>{refreshing ? "Refreshing…" : "Refresh"}</button></div>
      </footer>
    </div>}

    {section === "Tasks" && <div className="space-y-5"><div className="flex justify-end"><button type="button" onClick={() => show("Chat")} className={secondaryButton}>New task</button></div><JarvisTasks key={revision} />{findingList()}</div>}
    {section === "Approvals" && <JarvisAgents key={revision} approvalsOnly />}
    {section === "Team" && <JarvisAgents />}
    {section === "Setup" && <JarvisSetup />}
    {section === "Chat" && <JarvisChat />}
    {section === "Activity" && <div className="space-y-5"><article className={panel}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Workflow activity</h2><button type="button" onClick={refresh} disabled={refreshing} className={secondaryButton}>Refresh</button></div>
      <p className="mt-2 text-sm text-slate-400">Coding results are review artifacts. They are not deployed changes.</p>
      {worker === null && <p role="status" className="mt-4 text-sm text-slate-400">Loading activity…</p>}
      {worker && !worker.connected && <p className="mt-4 text-sm text-amber-200">Priority-check status is unavailable. Check Setup.</p>}
      {worker && !worker.codingStatusAvailable && <p className="mt-4 text-sm text-amber-200">Coding-review status is unavailable. Check Setup.</p>}
      {worker?.connected && worker.codingStatusAvailable && !activity.length && <p className="mt-4 text-sm text-slate-400">No workflow runs yet.</p>}
      <div className="mt-4 divide-y divide-white/10">{activity.map(run => <a key={`${run.kind}-${run.id}`} href={run.url} target="_blank" rel="noopener noreferrer" className="flex min-h-16 items-center justify-between gap-3 py-4 text-sm hover:text-blue-300"><div><p className="font-medium">{run.kind}</p><p className="mt-1 text-xs text-slate-400">{new Date(run.createdAt).toLocaleString()}</p></div><span className="rounded-lg border border-white/15 px-3 py-2 text-xs">{runLabel(run)}</span></a>)}</div>
    </article></div>}
  </div>;
}
