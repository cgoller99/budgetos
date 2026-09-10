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
import { detectAiTeamActionCommand } from "@/lib/ai-team/actionCommands";
import type {
  AiTeamActionDefinition,
  AiTeamActionExecution,
  AiTeamActivityEvent,
  AiTeamAgent,
  AiTeamApprovalDecision,
  AiTeamAutonomyLevel,
  AiTeamCustomerVoice,
  AiTeamExecutionCandidate,
  AiTeamExecutionPacket,
  AiTeamFounderBrief,
  AiTeamMission,
  AiTeamPlan,
  AiTeamPlanningUsage,
  AiTeamPlaybook,
  AiTeamProductAnalytics,
  AiTeamRevenueIntelligence,
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
import { CustomerVoiceCenter } from "./ai-team/CustomerVoiceCenter";
import { ExecutionCenter } from "./ai-team/ExecutionCenter";
import { FounderBriefCenter } from "./ai-team/FounderBriefCenter";
import { ProductAnalyticsCenter } from "./ai-team/ProductAnalyticsCenter";
import { RevenueCenter } from "./ai-team/RevenueCenter";

type GetPayload = {
  agents: AiTeamAgent[];
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
  recentRuns: AiTeamRun[];
  approvalRuns: AiTeamRun[];
  approvalDecisions: AiTeamApprovalDecision[];
  playbooks: AiTeamPlaybook[];
  recentMissions: AiTeamMission[];
  planningUsage: AiTeamPlanningUsage;
};

type PostPayload = {
  operationId: string;
  plan: AiTeamPlan;
  run: AiTeamRun;
  mission: AiTeamMission;
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
};

type ActionPostPayload = {
  operationId: string;
  action: AiTeamActionDefinition;
  execution: AiTeamActionExecution;
  mission: AiTeamMission;
  snapshot: AiTeamSnapshot | null;
  founderBrief: AiTeamFounderBrief | null;
};

type ActivityPayload = {
  operationId: string | null;
  runId?: string | null;
  events: AiTeamActivityEvent[];
};

type TabId =
  | "command"
  | "work"
  | "execution"
  | "analytics"
  | "revenue"
  | "customer-voice"
  | "brief"
  | "runs"
  | "approvals"
  | "playbooks"
  | "evidence"
  | "agents";

type V3TabId =
  | "execution"
  | "analytics"
  | "revenue"
  | "customer-voice"
  | "brief";

type V3LoadState = {
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

const V3_TAB_IDS: V3TabId[] = [
  "execution",
  "analytics",
  "revenue",
  "customer-voice",
  "brief",
];

const INITIAL_V3_LOAD_STATE: Record<V3TabId, V3LoadState> = {
  execution: { loaded: false, loading: false, error: null },
  analytics: { loaded: false, loading: false, error: null },
  revenue: { loaded: false, loading: false, error: null },
  "customer-voice": { loaded: false, loading: false, error: null },
  brief: { loaded: false, loading: false, error: null },
};

function isV3Tab(tab: TabId): tab is V3TabId {
  return V3_TAB_IDS.includes(tab as V3TabId);
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "command", label: "Command" },
  { id: "work", label: "Work" },
  { id: "execution", label: "Execution" },
  { id: "analytics", label: "Analytics" },
  { id: "revenue", label: "Revenue" },
  { id: "customer-voice", label: "Customer Voice" },
  { id: "brief", label: "Brief" },
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
  const [missions, setMissions] = useState<AiTeamMission[]>([]);
  const [currentMission, setCurrentMission] = useState<AiTeamMission | null>(null);
  const [autonomyLevel, setAutonomyLevel] =
    useState<AiTeamAutonomyLevel>("assist");
  const [executionCandidates, setExecutionCandidates] = useState<AiTeamExecutionCandidate[]>([]);
  const [executionPackets, setExecutionPackets] = useState<AiTeamExecutionPacket[]>([]);
  const [productAnalytics, setProductAnalytics] = useState<AiTeamProductAnalytics | null>(null);
  const [revenueIntelligence, setRevenueIntelligence] = useState<AiTeamRevenueIntelligence | null>(null);
  const [customerVoice, setCustomerVoice] = useState<AiTeamCustomerVoice | null>(null);
  const [founderBrief, setFounderBrief] = useState<AiTeamFounderBrief | null>(null);
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [v3LoadState, setV3LoadState] =
    useState<Record<V3TabId, V3LoadState>>(INITIAL_V3_LOAD_STATE);
  const [planningUsage, setPlanningUsage] = useState<AiTeamPlanningUsage>({
    used: 0,
    limit: 40,
  });
  const [goal, setGoal] = useState("");
  const [activity, setActivity] = useState<AiTeamActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const operationVersion = useRef(0);
  const activeOperationId = useRef<string | null>(null);
  const activityInterval = useRef<number | null>(null);
  const restoredActivityRunId = useRef<string | null>(null);
  const missionAbortController = useRef<AbortController | null>(null);
  const planningRef = useRef(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const v3LoadedRef = useRef<Record<V3TabId, boolean>>({
    execution: false,
    analytics: false,
    revenue: false,
    "customer-voice": false,
    brief: false,
  });
  const v3LoadingRef = useRef<Record<V3TabId, boolean>>({
    execution: false,
    analytics: false,
    revenue: false,
    "customer-voice": false,
    brief: false,
  });
  const v3RequestVersion = useRef<Record<V3TabId, number>>({
    execution: 0,
    analytics: 0,
    revenue: 0,
    "customer-voice": 0,
    brief: 0,
  });

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
      setMissions(data.recentMissions ?? []);
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

  const loadV3Tab = useCallback(async (tab: V3TabId, refresh = false) => {
    if (
      (!refresh && v3LoadedRef.current[tab]) ||
      v3LoadingRef.current[tab]
    ) {
      return;
    }

    const version = ++v3RequestVersion.current[tab];
    v3LoadingRef.current[tab] = true;
    setV3LoadState((current) => ({
      ...current,
      [tab]: { ...current[tab], loading: true, error: null },
    }));

    try {
      const response = await fetch(`/api/admin/ai-team/${tab}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Unable to load ${tab.replace("-", " ")}.`);
      }
      if (version !== v3RequestVersion.current[tab]) return;

      if (tab === "execution") {
        const executionPayload = payload as {
          packets?: AiTeamExecutionPacket[];
          candidates?: AiTeamExecutionCandidate[];
        };
        setExecutionPackets(executionPayload.packets ?? []);
        setExecutionCandidates(executionPayload.candidates ?? []);
      } else if (tab === "analytics") {
        setProductAnalytics(payload as AiTeamProductAnalytics);
      } else if (tab === "revenue") {
        setRevenueIntelligence(payload as AiTeamRevenueIntelligence);
      } else if (tab === "customer-voice") {
        setCustomerVoice(payload as AiTeamCustomerVoice);
      } else {
        setFounderBrief(
          (payload as { brief?: AiTeamFounderBrief | null }).brief ?? null,
        );
      }

      v3LoadedRef.current[tab] = true;
      setV3LoadState((current) => ({
        ...current,
        [tab]: { loaded: true, loading: false, error: null },
      }));
    } catch (loadError) {
      if (version !== v3RequestVersion.current[tab]) return;
      setV3LoadState((current) => ({
        ...current,
        [tab]: {
          ...current[tab],
          loading: false,
          error:
            loadError instanceof Error
              ? loadError.message
              : `Unable to load ${tab.replace("-", " ")}.`,
        },
      }));
    } finally {
      if (version === v3RequestVersion.current[tab]) {
        v3LoadingRef.current[tab] = false;
      }
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (!planningRef.current) void load();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (isV3Tab(activeTab)) void loadV3Tab(activeTab);
  }, [activeTab, loadV3Tab]);

  useEffect(() => {
    const latestRunId = runs[0]?.id;
    if (
      !latestRunId ||
      planningRef.current ||
      activeOperationId.current ||
      activity.length > 0 ||
      restoredActivityRunId.current === latestRunId
    ) {
      return;
    }

    restoredActivityRunId.current = latestRunId;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/ai-team/activity?runId=${encodeURIComponent(latestRunId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => ({}))) as
          | ActivityPayload
          | { error?: string };
        if (
          cancelled ||
          planningRef.current ||
          activeOperationId.current ||
          !response.ok ||
          !("events" in payload)
        ) {
          return;
        }
        setActivity(payload.events);
      } catch {
        // Historical trace is optional; the run itself remains authoritative.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runs, activity.length]);

  useEffect(
    () => () => {
      if (activityInterval.current !== null) {
        window.clearInterval(activityInterval.current);
      }
      missionAbortController.current?.abort();
    },
    [],
  );

  async function createPlan(
    context: Record<string, unknown> = {},
    commandOverride?: string,
  ) {
    const trimmed = (commandOverride ?? goal).trim();
    if (trimmed.length < 3 || planningRef.current) return;
    const operationId = crypto.randomUUID();
    const version = ++operationVersion.current;
    activeOperationId.current = operationId;
    requestVersion.current += 1;
    planningRef.current = true;
    const abortController = new AbortController();
    missionAbortController.current = abortController;
    setPlanning(true);
    setActivity([]);
    setCurrentMission(null);
    setError(null);

    const pollActivity = async () => {
      if (
        operationVersion.current !== version ||
        activeOperationId.current !== operationId
      ) {
        return;
      }
      try {
        const response = await fetch(
          `/api/admin/ai-team/activity?operationId=${encodeURIComponent(operationId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => ({}))) as
          | ActivityPayload
          | { error?: string };
        if (!response.ok || !("events" in payload)) return;
        if (
          operationVersion.current !== version ||
          activeOperationId.current !== operationId
        ) {
          return;
        }
        setActivity((current) =>
          payload.events.length >= current.length ? payload.events : current,
        );
        if (
          payload.events.some(
            (event) =>
              event.phase === "operation" &&
              (event.status === "completed" || event.status === "failed"),
          ) &&
          activityInterval.current !== null
        ) {
          window.clearInterval(activityInterval.current);
          activityInterval.current = null;
        }
      } catch {
        // The POST remains authoritative; the next poll can recover the trace.
      }
      try {
        const missionResponse = await fetch(
          `/api/admin/ai-team/missions?operationId=${encodeURIComponent(operationId)}`,
          { cache: "no-store" },
        );
        const missionPayload = (await missionResponse.json().catch(() => ({}))) as {
          mission?: AiTeamMission | null;
        };
        if (
          missionResponse.ok &&
          missionPayload.mission &&
          operationVersion.current === version &&
          activeOperationId.current === operationId
        ) {
          setCurrentMission(missionPayload.mission);
          setMissions((current) => [
            missionPayload.mission!,
            ...current.filter((item) => item.id !== missionPayload.mission!.id),
          ].slice(0, 20));
        }
      } catch {
        // The final POST response remains authoritative.
      }
    };

    void pollActivity();
    activityInterval.current = window.setInterval(() => {
      void pollActivity();
    }, 800);

    const registeredAction = detectAiTeamActionCommand(trimmed);
    const endpoint = registeredAction
      ? "/api/admin/ai-team/actions"
      : "/api/admin/ai-team";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: trimmed,
          operationId,
          autonomyLevel,
          context,
        }),
        signal: abortController.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as
        | PostPayload
        | ActionPostPayload
        | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to execute command.");
      }

      if (registeredAction) {
        const data = payload as ActionPostPayload;
        if (data.snapshot) setSnapshot(data.snapshot);
        setCurrentMission(data.mission);
        setMissions((current) => [
          data.mission,
          ...current.filter((mission) => mission.id !== data.mission.id),
        ].slice(0, 20));
        if (data.founderBrief) {
          setFounderBrief(data.founderBrief);
          v3LoadedRef.current.brief = true;
          setV3LoadState((current) => ({
            ...current,
            brief: { loaded: true, loading: false, error: null },
          }));
        }
      } else {
        const data = payload as PostPayload;
        setRuntime(data.runtime);
        setSnapshot(data.snapshot);
        setCurrentMission(data.mission);
        setMissions((current) => [
          data.mission,
          ...current.filter((mission) => mission.id !== data.mission.id),
        ].slice(0, 20));
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
      }
    } catch (planError) {
      if (!(planError instanceof DOMException && planError.name === "AbortError")) {
        setError(planError instanceof Error ? planError.message : "Unable to execute command.");
      }
    } finally {
      if (activityInterval.current !== null) {
        window.clearInterval(activityInterval.current);
        activityInterval.current = null;
      }
      await pollActivity();
      activeOperationId.current = null;
      if (missionAbortController.current === abortController) {
        missionAbortController.current = null;
      }
      planningRef.current = false;
      setPlanning(false);
    }
  }

  async function stopMissionSession(): Promise<string> {
    const missionId = currentMission?.id ?? null;
    const operationId = activeOperationId.current;
    operationVersion.current += 1;
    missionAbortController.current?.abort();
    missionAbortController.current = null;
    if (activityInterval.current !== null) {
      window.clearInterval(activityInterval.current);
      activityInterval.current = null;
    }
    activeOperationId.current = null;
    planningRef.current = false;
    setPlanning(false);

    if (!missionId && !operationId) {
      return "Client request, polling, microphone, and screen sharing stopped. No active mission or operation id was available for a server stop request.";
    }
    try {
      const response = await fetch("/api/admin/ai-team/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: missionId ?? undefined,
          operationId: missionId ? undefined : operationId,
          action: "stop",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        mission?: AiTeamMission | null;
        stopRecorded?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.stopRecorded) {
        return payload.error ?? "Client work stopped, but the server stop request was not recorded.";
      }
      if (payload.mission) {
        setCurrentMission(payload.mission);
        setMissions((current) => [
          payload.mission!,
          ...current.filter((mission) => mission.id !== payload.mission!.id),
        ].slice(0, 20));
      }
      return payload.message ??
        "Stop request recorded. Already-running server work may take time to observe it.";
    } catch {
      return "Client work stopped, but the server stop request could not be confirmed.";
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

  async function refreshFounderBrief() {
    if (v3LoadingRef.current.brief) return;
    const version = ++v3RequestVersion.current.brief;
    v3LoadingRef.current.brief = true;
    setBriefGenerating(true);
    setV3LoadState((current) => ({
      ...current,
      brief: { ...current.brief, loading: true, error: null },
    }));
    try {
      const response = await fetch("/api/admin/ai-team/brief", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        brief?: AiTeamFounderBrief;
        error?: string;
      };
      if (!response.ok || !payload.brief) {
        throw new Error(payload.error ?? "Unable to generate founder brief.");
      }
      if (version !== v3RequestVersion.current.brief) return;
      setFounderBrief(payload.brief);
      v3LoadedRef.current.brief = true;
      setV3LoadState((current) => ({
        ...current,
        brief: { loaded: true, loading: false, error: null },
      }));
    } catch (briefError) {
      if (version !== v3RequestVersion.current.brief) return;
      setV3LoadState((current) => ({
        ...current,
        brief: {
          ...current.brief,
          loading: false,
          error:
            briefError instanceof Error
              ? briefError.message
              : "Unable to generate founder brief.",
        },
      }));
    } finally {
      if (version === v3RequestVersion.current.brief) {
        v3LoadingRef.current.brief = false;
        setBriefGenerating(false);
      }
    }
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
          <Badge variant="accent">Buxme OS V5.3</Badge>
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
    <section id="ai-team" className="scroll-mt-28 space-y-5" aria-label="Buxme OS V5.3 Mission Control">
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
            createPlan={(context, commandOverride) =>
              void createPlan(context, commandOverride)
            }
            planning={planning}
            activity={activity}
            runtime={runtime}
            snapshot={snapshot}
            runs={runs}
            approvalRuns={approvalRuns}
            decisions={decisions}
            planningUsage={planningUsage}
            agentCount={agents.length}
            onRefresh={() => void load()}
            refreshing={loading}
            missions={missions}
            currentMission={currentMission}
            autonomyLevel={autonomyLevel}
            setAutonomyLevel={setAutonomyLevel}
            onStopSession={stopMissionSession}
          />
        ) : null}
        {activeTab === "work" ? <WorkQueue runs={runs} decisions={decisions} /> : null}
        {activeTab === "execution" ? (
          <ExecutionCenter
            candidates={executionCandidates}
            packets={executionPackets}
            onStaged={(packet) => {
              setExecutionPackets((current) => [
                packet,
                ...current.filter((item) => item.id !== packet.id),
              ]);
              setExecutionCandidates((current) =>
                current.filter((candidate) => candidate.task.id !== packet.taskId),
              );
            }}
            onRefresh={() => void loadV3Tab("execution", true)}
            loading={v3LoadState.execution.loading}
            error={v3LoadState.execution.error}
          />
        ) : null}
        {activeTab === "analytics" ? (
          <ProductAnalyticsCenter
            data={productAnalytics}
            onRefresh={() => void loadV3Tab("analytics", true)}
            loading={v3LoadState.analytics.loading}
            error={v3LoadState.analytics.error}
          />
        ) : null}
        {activeTab === "revenue" ? (
          <RevenueCenter
            data={revenueIntelligence}
            onRefresh={() => void loadV3Tab("revenue", true)}
            loading={v3LoadState.revenue.loading}
            error={v3LoadState.revenue.error}
          />
        ) : null}
        {activeTab === "customer-voice" ? (
          <CustomerVoiceCenter
            data={customerVoice}
            onRefresh={() => void loadV3Tab("customer-voice", true)}
            loading={v3LoadState["customer-voice"].loading}
            error={v3LoadState["customer-voice"].error}
          />
        ) : null}
        {activeTab === "brief" ? (
          <FounderBriefCenter
            brief={founderBrief}
            onRefresh={refreshFounderBrief}
            refreshing={briefGenerating || v3LoadState.brief.loading}
            error={v3LoadState.brief.error}
          />
        ) : null}
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
