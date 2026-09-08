"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Badge, Button, LoadingSkeleton } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type {
  AiTeamAgent,
  AiTeamApprovalDecision,
  AiTeamPlan,
  AiTeamPlanningUsage,
  AiTeamPlaybook,
  AiTeamRun,
  AiTeamRuntimeInfo,
  AiTeamSnapshot,
} from "@/lib/ai-team/types";
import { AgentDirectory, EvidenceCenter } from "./ai-team/EvidenceAndAgents";
import { ApprovalCenter } from "./ai-team/ApprovalCenter";
import { CommandCenter } from "./ai-team/CommandCenter";
import { Playbooks } from "./ai-team/Playbooks";
import { RunExplorer } from "./ai-team/RunExplorer";
import { WorkQueue } from "./ai-team/WorkQueue";

type GetPayload = {
  agents: AiTeamAgent[];
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
  recentRuns: AiTeamRun[];
  approvalRuns: AiTeamRun[];
  approvalDecisions: AiTeamApprovalDecision[];
  playbooks: AiTeamPlaybook[];
  planningUsage: AiTeamPlanningUsage;
};

type PostPayload = {
  plan: AiTeamPlan;
  run: AiTeamRun;
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
};

type TabId =
  | "command"
  | "work"
  | "runs"
  | "approvals"
  | "playbooks"
  | "evidence"
  | "agents";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "command", label: "Command" },
  { id: "work", label: "Work Queue" },
  { id: "runs", label: "Runs" },
  { id: "approvals", label: "Approvals" },
  { id: "playbooks", label: "Playbooks" },
  { id: "evidence", label: "Evidence" },
  { id: "agents", label: "Agents" },
];

export function AdminAiTeamSection() {
  const [activeTab, setActiveTab] = useState<TabId>("command");
  const [agents, setAgents] = useState<AiTeamAgent[]>([]);
  const [runtime, setRuntime] = useState<AiTeamRuntimeInfo | null>(null);
  const [snapshot, setSnapshot] = useState<AiTeamSnapshot | null>(null);
  const [runs, setRuns] = useState<AiTeamRun[]>([]);
  const [approvalRuns, setApprovalRuns] = useState<AiTeamRun[]>([]);
  const [decisions, setDecisions] = useState<AiTeamApprovalDecision[]>([]);
  const [playbooks, setPlaybooks] = useState<AiTeamPlaybook[]>([]);
  const [planningUsage, setPlanningUsage] = useState<AiTeamPlanningUsage>({
    used: 0,
    limit: 40,
  });
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const planningRef = useRef(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ai-team", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as
        | GetPayload
        | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load AI Team.");
      }
      if (version !== requestVersion.current || planningRef.current) return;
      const data = payload as GetPayload;
      setAgents(data.agents);
      setRuntime(data.runtime);
      setSnapshot(data.snapshot);
      setRuns(data.recentRuns);
      setApprovalRuns(data.approvalRuns);
      setDecisions(data.approvalDecisions);
      setPlaybooks(data.playbooks);
      setPlanningUsage(data.planningUsage);
      setError(null);
    } catch (loadError) {
      if (version === requestVersion.current) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load AI Team.");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (!planningRef.current) void load();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function createPlan() {
    const trimmed = goal.trim();
    if (trimmed.length < 3 || planningRef.current) return;
    requestVersion.current += 1;
    planningRef.current = true;
    setPlanning(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed }),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | PostPayload
        | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to create plan.");
      }
      const data = payload as PostPayload;
      setRuntime(data.runtime);
      setSnapshot(data.snapshot);
      setRuns((current) => [data.run, ...current.filter((run) => run.id !== data.run.id)].slice(0, 20));
      if (data.run.tasks.some((task) => task.requiresApproval)) {
        setApprovalRuns((current) => [
          data.run,
          ...current.filter((run) => run.id !== data.run.id),
        ].slice(0, 20));
      }
      setPlanningUsage((current) => ({
        ...current,
        used: Math.min(current.limit, current.used + 1),
      }));
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to create plan.");
    } finally {
      planningRef.current = false;
      setPlanning(false);
    }
  }

  async function recordDecision(
    taskId: string,
    decision: "approved" | "rejected",
    note: string,
  ) {
    setError(null);
    const response = await fetch("/api/admin/ai-team/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, decision, note }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      decision?: AiTeamApprovalDecision;
      error?: string;
    };
    if (!response.ok || !payload.decision) {
      const message = payload.error ?? "Unable to record decision.";
      setError(message);
      throw new Error(message);
    }
    setDecisions((current) => [payload.decision!, ...current]);
    const applyTaskStatus = (current: AiTeamRun[]) =>
      current.map((run) => ({
        ...run,
        tasks: run.tasks.map((task) =>
          task.id === taskId ? { ...task, status: decision } : task,
        ),
      }));
    setRuns(applyTaskStatus);
    setApprovalRuns(applyTaskStatus);
  }

  async function savePlaybook(draft: {
    id?: string;
    title: string;
    description: string;
    category: string;
    goalTemplate: string;
    favorite: boolean;
  }) {
    setError(null);
    const response = await fetch("/api/admin/ai-team/playbooks", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      playbook?: AiTeamPlaybook;
      error?: string;
    };
    if (!response.ok || !payload.playbook) {
      const message = payload.error ?? "Unable to save playbook.";
      setError(message);
      throw new Error(message);
    }
    setPlaybooks((current) =>
      [payload.playbook!, ...current.filter((item) => item.id !== payload.playbook!.id)]
        .sort((a, b) => Number(b.favorite) - Number(a.favorite)),
    );
  }

  async function deletePlaybook(id: string) {
    setError(null);
    const response = await fetch("/api/admin/ai-team/playbooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      const message = payload.error ?? "Unable to delete playbook.";
      setError(message);
      throw new Error(message);
    }
    setPlaybooks((current) => current.filter((item) => item.id !== id));
  }

  function selectGoal(value: string) {
    setGoal(value);
    setActiveTab("command");
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    setActiveTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  if (loading && !runtime) {
    return (
      <section id="ai-team" className="scroll-mt-28 space-y-5" aria-label="AI Mission Control">
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-8">
          <Badge variant="accent">AI Team V2</Badge>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
            Initializing Mission Control
          </h2>
          <LoadingSkeleton className="mt-6 max-w-3xl" lines={4} />
        </div>
      </section>
    );
  }

  if ((!runtime || !snapshot) && error) {
    return (
      <section id="ai-team" className="scroll-mt-28">
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-10 text-center">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Mission Control is unavailable</h2>
          <p className="mt-2 text-sm text-rose-200">{error}</p>
          <Button className="mt-5" onClick={() => void load()}>Retry</Button>
        </div>
      </section>
    );
  }

  if (!runtime || !snapshot) return null;

  const tabCount: Partial<Record<TabId, number>> = {
    work: runs.reduce((total, run) => total + run.tasks.length, 0),
    runs: runs.length,
    approvals: approvalRuns
      .flatMap((run) => run.tasks)
      .filter(
        (task) =>
          task.requiresApproval &&
          !decisions.some((decision) => decision.taskId === task.id),
      ).length,
    playbooks: playbooks.length + 8,
    evidence: 5,
    agents: agents.length,
  };

  return (
    <section id="ai-team" className="scroll-mt-28 space-y-5" aria-label="AI Mission Control V2">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="AI Mission Control sections"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-1.5"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`ai-tab-${tab.id}`}
            aria-controls={`ai-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            className={cn(
              "focus-ring flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm transition-colors",
              activeTab === tab.id
                ? "bg-[var(--surface-elevated)] text-[var(--foreground)]"
                : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
            {tabCount[tab.id] !== undefined ? (
              <span className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] tabular-nums">
                {tabCount[tab.id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`ai-panel-${activeTab}`} aria-labelledby={`ai-tab-${activeTab}`} tabIndex={0}>
        {activeTab === "command" ? (
          <CommandCenter
            goal={goal}
            setGoal={setGoal}
            createPlan={() => void createPlan()}
            planning={planning}
            runtime={runtime}
            snapshot={snapshot}
            runs={runs}
            approvalRuns={approvalRuns}
            decisions={decisions}
            planningUsage={planningUsage}
            agentCount={agents.length}
            onRefresh={() => void load()}
            refreshing={loading}
          />
        ) : null}
        {activeTab === "work" ? <WorkQueue runs={runs} decisions={decisions} /> : null}
        {activeTab === "runs" ? <RunExplorer runs={runs} /> : null}
        {activeTab === "approvals" ? (
          <ApprovalCenter runs={approvalRuns} decisions={decisions} onDecision={recordDecision} />
        ) : null}
        {activeTab === "playbooks" ? (
          <Playbooks
            playbooks={playbooks}
            currentGoal={goal}
            onChoose={selectGoal}
            onSave={savePlaybook}
            onDelete={deletePlaybook}
          />
        ) : null}
        {activeTab === "evidence" ? <EvidenceCenter snapshot={snapshot} /> : null}
        {activeTab === "agents" ? <AgentDirectory agents={agents} goal={goal} /> : null}
      </div>
    </section>
  );
}
