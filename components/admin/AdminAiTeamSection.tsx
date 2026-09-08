"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  IconBadge,
  LoadingSkeleton,
} from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { selectAiTeamSpecialists } from "@/lib/ai-team/routing";
import type {
  AiTeamAgent,
  AiTeamAgentId,
  AiTeamPlan,
  AiTeamRun,
  AiTeamRuntimeInfo,
  AiTeamSnapshot,
  AiTeamTask,
  AiTeamTaskStatus,
} from "@/lib/ai-team/types";

type AiTeamGetPayload = {
  agents: AiTeamAgent[];
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
  recentRuns: AiTeamRun[];
  approvalRuns?: AiTeamRun[];
};

type AiTeamPostPayload = {
  plan: AiTeamPlan;
  run: AiTeamRun;
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
};

type TabId = "overview" | "team" | "runs" | "approvals" | "evidence";
type IconName =
  | "command"
  | "team"
  | "runs"
  | "approval"
  | "evidence"
  | "chief"
  | "engineering"
  | "qa"
  | "analytics"
  | "product"
  | "growth"
  | "customer"
  | "critic"
  | "arrow"
  | "refresh";

const TABS: Array<{ id: TabId; label: string; icon: IconName }> = [
  { id: "overview", label: "Overview", icon: "command" },
  { id: "team", label: "Team", icon: "team" },
  { id: "runs", label: "Runs", icon: "runs" },
  { id: "approvals", label: "Approvals", icon: "approval" },
  { id: "evidence", label: "Evidence", icon: "evidence" },
];

const QUICK_GOALS = [
  {
    label: "Launch risk",
    goal: "Identify the biggest launch risk using current evidence and recommend the safest next step.",
  },
  {
    label: "Onboarding conversion",
    goal: "Review onboarding and activation evidence, identify the clearest conversion opportunity, and define how to measure it.",
  },
  {
    label: "Plaid health",
    goal: "Analyze current Plaid connection health and produce a read-only investigation plan for the most important risk.",
  },
  {
    label: "Support themes",
    goal: "Summarize the most important support and feedback themes available in current evidence without inventing missing customer context.",
  },
  {
    label: "Growth experiment",
    goal: "Design one measurable, low-risk growth experiment from current evidence with a clear success metric.",
  },
  {
    label: "Release QA",
    goal: "Create a focused release QA plan for Buxme's critical user flows and call out evidence gaps before launch.",
  },
] as const;

const AGENT_META: Record<
  AiTeamAgentId,
  {
    icon: IconName;
    tone: "accent" | "success" | "warning" | "danger" | "purple" | "neutral";
    categories: string[];
  }
> = {
  chief_of_staff: {
    icon: "chief",
    tone: "accent",
    categories: ["Core", "Orchestrator"],
  },
  engineering: {
    icon: "engineering",
    tone: "purple",
    categories: ["Specialist"],
  },
  qa: { icon: "qa", tone: "success", categories: ["Specialist"] },
  analytics: {
    icon: "analytics",
    tone: "accent",
    categories: ["Core", "Specialist"],
  },
  product: {
    icon: "product",
    tone: "purple",
    categories: ["Specialist"],
  },
  growth: {
    icon: "growth",
    tone: "success",
    categories: ["Specialist"],
  },
  customer: {
    icon: "customer",
    tone: "warning",
    categories: ["Specialist"],
  },
  critic: {
    icon: "critic",
    tone: "danger",
    categories: ["Core", "Reviewer"],
  },
};

const AGENT_LABELS: Record<AiTeamAgentId, string> = {
  chief_of_staff: "Chief of Staff",
  engineering: "Engineering",
  qa: "QA",
  analytics: "Analytics",
  product: "Product",
  growth: "Growth",
  customer: "Customer",
  critic: "Critic",
};

function MissionIcon({
  name,
  className = "size-4",
}: {
  name: IconName;
  className?: string;
}) {
  let content: ReactNode;

  switch (name) {
    case "command":
      content = (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </>
      );
      break;
    case "team":
      content = (
        <>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6M14 15c3.5-.5 5.5 1.2 6 4" />
        </>
      );
      break;
    case "runs":
      content = (
        <>
          <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
        </>
      );
      break;
    case "approval":
      content = (
        <>
          <path d="M12 3 20 7v5c0 4.8-3.2 7.6-8 9-4.8-1.4-8-4.2-8-9V7z" />
          <path d="M12 8v5M12 17h.01" />
        </>
      );
      break;
    case "evidence":
      content = (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5M8 10.5l1.7 1.7L13.5 8" />
        </>
      );
      break;
    case "chief":
      content = (
        <>
          <path d="M4 18h16M6 16l1-8 5 4 5-4 1 8zM8 5l4 3 4-3" />
        </>
      );
      break;
    case "engineering":
      content = (
        <>
          <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
        </>
      );
      break;
    case "qa":
      content = (
        <>
          <path d="M12 3 20 7v5c0 4.8-3.2 7.6-8 9-4.8-1.4-8-4.2-8-9V7z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      );
      break;
    case "analytics":
      content = (
        <>
          <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
        </>
      );
      break;
    case "product":
      content = (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 9h8M8 13h5M8 17h3" />
        </>
      );
      break;
    case "growth":
      content = (
        <>
          <path d="M4 18 10 12l4 3 6-8M15 7h5v5" />
        </>
      );
      break;
    case "customer":
      content = (
        <>
          <path d="M4 5h16v11H9l-5 4z" />
          <path d="M8 9h8M8 12h5" />
        </>
      );
      break;
    case "critic":
      content = (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 5 5M8 11h6" />
        </>
      );
      break;
    case "arrow":
      content = <path d="m8 10 4 4 4-4" />;
      break;
    case "refresh":
      content = (
        <>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M6.1 8A7 7 0 0 1 18 6l2 6M17.9 16A7 7 0 0 1 6 18l-2-6" />
        </>
      );
      break;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {content}
    </svg>
  );
}

function statusVariant(status: AiTeamTaskStatus) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "needs_approval") return "warning" as const;
  if (status === "running") return "accent" as const;
  return "default" as const;
}

function formatStatus(status: AiTeamTaskStatus): string {
  return status.replaceAll("_", " ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "Waiting for evidence";
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return formatDate(value);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just refreshed";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(value);
}

function shortModelName(value: string | null | undefined): string {
  if (!value) return "Deterministic planner";
  return value.split("/").at(-1) ?? value;
}

function MetricTile({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-4 sm:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "warning" ? "text-amber-300" : "text-[var(--foreground)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function AgentPill({
  id,
  compact = false,
}: {
  id: AiTeamAgentId;
  compact?: boolean;
}) {
  const meta = AGENT_META[id];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
      )}
    >
      <MissionIcon name={meta.icon} className={compact ? "size-3.5" : "size-4"} />
      {AGENT_LABELS[id]}
    </span>
  );
}

function TaskDetail({ task }: { task: AiTeamTask }) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AgentPill id={task.owner} compact />
        <Badge variant={statusVariant(task.status)} className="capitalize">
          {formatStatus(task.status)}
        </Badge>
      </div>
      <h4 className="mt-3 text-sm font-semibold text-[var(--foreground)]">{task.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
        {task.objective}
      </p>
      {task.evidence.length > 0 ? (
        <div className="mt-3 border-t border-[var(--surface-border)] pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Evidence used
          </p>
          <ul className="mt-2 space-y-1.5">
            {task.evidence.map((evidence) => (
              <li key={evidence} className="flex gap-2 text-xs text-[var(--text-muted)]">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {task.requiresApproval ? (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
          <span className="font-semibold">Approval gate:</span>{" "}
          {task.approvalReason ?? "Production-sensitive action requires approval."}
        </div>
      ) : null}
    </div>
  );
}

function RunCard({ run }: { run: AiTeamRun }) {
  const approvalCount = run.tasks.filter((task) => task.requiresApproval).length;

  return (
    <details className="group overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] open:border-[var(--surface-border-strong)]">
      <summary className="focus-ring flex cursor-pointer list-none items-start gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-light)]">
          <MissionIcon name="runs" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={run.source === "ai" ? "success" : "default"}>
              {run.source === "ai" ? "AI runtime" : "Fallback"}
            </Badge>
            <time dateTime={run.createdAt} className="text-xs text-[var(--text-muted)]">
              {formatDate(run.createdAt)}
            </time>
          </div>
          <p className="mt-2 font-medium leading-snug text-[var(--foreground)]">{run.goal}</p>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{run.summary}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
            <span>{run.tasks.length} tasks</span>
            <span>{approvalCount} approval gates</span>
            <span>Model: {shortModelName(run.model)}</span>
          </div>
        </div>
        <MissionIcon
          name="arrow"
          className="mt-2 size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-[var(--surface-border)] px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Source</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {run.source === "ai" ? "AI coordinated" : "Deterministic fallback"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Model</p>
            <p className="mt-1 break-all text-sm text-[var(--text-secondary)]">
              {run.model ?? "No model used"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Evidence captured
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {formatDate(run.snapshot.generatedAt)}
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {run.tasks.map((task) => (
            <TaskDetail key={task.id} task={task} />
          ))}
        </div>
      </div>
    </details>
  );
}

function SourceCard({
  title,
  status,
  children,
}: {
  title: string;
  status: "live" | "partial" | "unavailable";
  children: ReactNode;
}) {
  const variant =
    status === "live" ? "success" : status === "partial" ? "warning" : "danger";
  const label =
    status === "live" ? "Available" : status === "partial" ? "Partial" : "Unavailable";

  return (
    <Card padding="compact" className="h-full">
      <CardHeader
        title={title}
        action={<Badge variant={variant}>{label}</Badge>}
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AdminAiTeamSection() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [agents, setAgents] = useState<AiTeamAgent[]>([]);
  const [runtime, setRuntime] = useState<AiTeamRuntimeInfo | null>(null);
  const [snapshot, setSnapshot] = useState<AiTeamSnapshot | null>(null);
  const [plan, setPlan] = useState<AiTeamPlan | null>(null);
  const [recentRuns, setRecentRuns] = useState<AiTeamRun[]>([]);
  const [approvalRuns, setApprovalRuns] = useState<AiTeamRun[]>([]);
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const planningRef = useRef(false);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadAiTeam = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai-team", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to load AI Team.");
      }

      const payload = (await response.json()) as AiTeamGetPayload;
      if (requestVersion !== requestVersionRef.current || planningRef.current) {
        return;
      }

      setAgents(payload.agents);
      setRuntime(payload.runtime);
      setSnapshot(payload.snapshot);
      setRecentRuns(payload.recentRuns);
      setApprovalRuns(
        payload.approvalRuns ??
          payload.recentRuns
            .map((run) => ({
              ...run,
              tasks: run.tasks.filter((task) => task.requiresApproval),
            }))
            .filter((run) => run.tasks.length > 0),
      );
    } catch (loadError) {
      if (requestVersion === requestVersionRef.current) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load AI Team.");
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAiTeam();

    const interval = window.setInterval(() => {
      if (!planningRef.current) void loadAiTeam();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [loadAiTeam]);

  const routedAgentIds = useMemo<AiTeamAgentId[]>(() => {
    const trimmed = goal.trim();
    if (trimmed.length < 3) return [];
    return [
      "chief_of_staff",
      ...selectAiTeamSpecialists(trimmed),
      "critic",
    ];
  }, [goal]);

  const approvalCount = useMemo(
    () => approvalRuns.reduce((total, run) => total + run.tasks.length, 0),
    [approvalRuns],
  );
  const openApprovalCount = useMemo(
    () =>
      approvalRuns.reduce(
        (total, run) =>
          total + run.tasks.filter((task) => task.status === "needs_approval").length,
        0,
      ),
    [approvalRuns],
  );

  const unhealthyChecks = useMemo(
    () => snapshot?.health.filter((check) => check.status !== "green") ?? [],
    [snapshot],
  );

  const unavailableEvidence = useMemo(() => {
    if (!snapshot) return [];
    const unavailable = [...snapshot.unavailableSources];
    if (snapshot.revenue && !snapshot.revenue.available) {
      unavailable.push("Stripe live revenue");
    }
    if (snapshot.plaid && !snapshot.plaid.available) {
      unavailable.push("Plaid live connection data");
    }
    return [...new Set(unavailable)];
  }, [snapshot]);

  const evidenceSourceStatus = useMemo(() => {
    if (!snapshot) {
      return {
        overview: false,
        revenue: false,
        plaid: false,
        analytics: false,
        health: false,
      };
    }

    const failed = new Set(snapshot.unavailableSources);
    return {
      overview: Boolean(snapshot.overview) && !failed.has("overview"),
      revenue:
        Boolean(snapshot.revenue?.available) && !failed.has("revenue"),
      plaid: Boolean(snapshot.plaid?.available) && !failed.has("plaid"),
      analytics: Boolean(snapshot.analytics) && !failed.has("analytics"),
      health: !failed.has("health"),
    };
  }, [snapshot]);

  const evidenceLoaded = useMemo(
    () => Object.values(evidenceSourceStatus).filter(Boolean).length,
    [evidenceSourceStatus],
  );

  const suggestedActions = useMemo(() => {
    if (!snapshot) return [];
    const actions: Array<{ title: string; detail: string; owner: AiTeamAgentId }> = [];

    if (unhealthyChecks.length > 0) {
      actions.push({
        title: "Review degraded health checks",
        detail: `${unhealthyChecks.length} check${unhealthyChecks.length === 1 ? "" : "s"} need attention: ${unhealthyChecks.map((check) => check.label).join(", ")}.`,
        owner: "engineering",
      });
    } else if (snapshot.health.length > 0) {
      actions.push({
        title: "Confirm the green system baseline",
        detail: `Review the evidence behind all ${snapshot.health.length} currently green health checks before the next release.`,
        owner: "qa",
      });
    }

    if (unavailableEvidence.length > 0) {
      actions.push({
        title: "Close evidence coverage gaps",
        detail: `Inspect why ${unavailableEvidence.join(", ")} ${unavailableEvidence.length === 1 ? "is" : "are"} unavailable. Do not infer missing values.`,
        owner: "engineering",
      });
    }

    if (snapshot.plaid?.available) {
      actions.push({
        title:
          snapshot.plaid.failedSyncs > 0
            ? "Analyze failed Plaid syncs"
            : "Validate Plaid connection health",
        detail: `${snapshot.plaid.connectedAccounts} connected accounts, ${snapshot.plaid.syncSuccessRate}% success rate, and ${snapshot.plaid.failedSyncs} failed syncs are currently reported.`,
        owner: "engineering",
      });
    }

    if (snapshot.revenue?.available && snapshot.revenue.failedPayments > 0) {
      actions.push({
        title: "Review failed-payment patterns",
        detail: `Analyze the ${snapshot.revenue.failedPayments} open failed-payment invoices without contacting customers or changing subscriptions.`,
        owner: "analytics",
      });
    } else if (snapshot.revenue) {
      const paidUsers = snapshot.revenue.proUsers + snapshot.revenue.proPlusUsers;
      actions.push({
        title: "Document the current revenue baseline",
        detail: `Compare the reported ${formatCurrency(snapshot.revenue.mrr)} MRR and ${paidUsers} paid users with recent subscription trends.`,
        owner: "analytics",
      });
    }

    if (
      snapshot.overview &&
      (snapshot.overview.totalBugReports > 0 ||
        snapshot.overview.totalFeedbackReports > 0)
    ) {
      actions.push({
        title: "Synthesize product signals",
        detail: `Read and group ${snapshot.overview.totalBugReports} bug reports and ${snapshot.overview.totalFeedbackReports} feedback reports into evidence-backed themes.`,
        owner: "customer",
      });
    }

    if (actions.length < 3 && snapshot.overview) {
      actions.push({
        title: "Establish an activation baseline",
        detail: `Compare ${snapshot.overview.activeUsers7d} active users in the last 7 days with ${snapshot.overview.totalUsers} total users and define the next question to investigate.`,
        owner: "analytics",
      });
    }

    if (
      actions.length < 3 &&
      snapshot.analytics &&
      Object.values(snapshot.analytics).some((series) => series.length > 0)
    ) {
      actions.push({
        title: "Review 30-day operating trends",
        detail: "Compare the available signup, activity, subscription, revenue, goal, bill, and household series for material changes.",
        owner: "analytics",
      });
    }

    return actions.slice(0, 5);
  }, [snapshot, unavailableEvidence, unhealthyChecks]);

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;

    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    window.requestAnimationFrame(() => tabButtonRefs.current[nextIndex]?.focus());
  }

  async function createPlan() {
    const trimmed = goal.trim();
    if (trimmed.length < 3) return;

    requestVersionRef.current += 1;
    planningRef.current = true;
    setLoading(false);
    setPlanning(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to create plan.");
      }

      const payload = (await response.json()) as AiTeamPostPayload;
      setPlan(payload.plan);
      setRuntime(payload.runtime);
      setSnapshot(payload.snapshot);
      setRecentRuns((current) =>
        [
          payload.run,
          ...current.filter((run) => run.id !== payload.run.id),
        ].slice(0, 20),
      );

      const gatedTasks = payload.run.tasks.filter((task) => task.requiresApproval);
      setApprovalRuns((current) => {
        const remaining = current.filter((run) => run.id !== payload.run.id);
        return gatedTasks.length > 0
          ? [{ ...payload.run, tasks: gatedTasks }, ...remaining]
          : remaining;
      });
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to create plan.");
    } finally {
      planningRef.current = false;
      setPlanning(false);
    }
  }

  if (loading && !runtime) {
    return (
      <section id="ai-team" className="scroll-mt-28 space-y-5" aria-label="AI Mission Control">
        <div className="overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl skeleton-shimmer" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-light)]">
                Buxme AI Team
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
                Initializing Mission Control
              </h2>
            </div>
          </div>
          <LoadingSkeleton className="mt-8 max-w-3xl" lines={3} />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-2xl border border-[var(--surface-border)] skeleton-shimmer"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section id="ai-team" className="scroll-mt-28">
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-8 text-center sm:p-12">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
            <MissionIcon name="command" className="size-6" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-[var(--foreground)]">
            Mission Control is unavailable
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-rose-200/80">{error}</p>
          <Button className="mt-6" onClick={() => void loadAiTeam()}>
            Retry connection
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section id="ai-team" className="scroll-mt-28 space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[var(--accent)]/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />
        <div className="relative">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent" className="uppercase tracking-[0.14em]">
                  Buxme AI Team
                </Badge>
                <Badge variant={runtime?.mode === "ai" ? "success" : "warning"}>
                  <span
                    className={cn(
                      "mr-1.5 size-1.5 rounded-full",
                      runtime?.mode === "ai" ? "bg-emerald-400" : "bg-amber-300",
                    )}
                  />
                  {runtime?.mode === "ai" ? "AI runtime online" : "Safe fallback active"}
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-muted)] text-[var(--accent-light)]">
                  <MissionIcon name="command" className="size-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
                    Mission Control
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    Evidence-first operating intelligence for Buxme. Every production-sensitive
                    action stops at an explicit approval gate.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:w-[430px]">
              <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background)]/40 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Orchestrator
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--foreground)]">
                  {shortModelName(runtime?.orchestratorModel)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background)]/40 px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Specialists
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[var(--foreground)]">
                  {shortModelName(runtime?.specialistModel)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background)]/40 px-3.5 py-3 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Last evidence refresh
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {formatRelativeTime(snapshot?.generatedAt)}
                      <span className="ml-2 font-normal text-[var(--text-muted)]">
                        · {formatDate(snapshot?.generatedAt)}
                      </span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadAiTeam()}
                    disabled={loading}
                    aria-label="Refresh AI Team evidence"
                  >
                    <MissionIcon
                      name="refresh"
                      className={cn("size-3.5", loading && "animate-spin")}
                    />
                    {loading ? "Refreshing" : "Refresh"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--surface-border)] pt-4 text-xs text-[var(--text-muted)]">
            <span>
              <strong className="font-semibold text-[var(--foreground)]">{agents.length}</strong>{" "}
              active agents
            </span>
            <span>
              <strong className="font-semibold text-[var(--foreground)]">
                {recentRuns.length}
              </strong>{" "}
              recent runs
            </span>
            <span>
              <strong className="font-semibold text-amber-300">{openApprovalCount}</strong> open
              approval gates
            </span>
            <span>
              <strong className="font-semibold text-[var(--foreground)]">{evidenceLoaded}/5</strong>{" "}
              evidence sources loaded
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile
          label="Total agents"
          value={String(agents.length)}
          detail="3 core · 5 operating specialists"
        />
        <MetricTile
          label="Recent runs"
          value={String(recentRuns.length)}
          detail="Latest persisted planning window"
        />
        <MetricTile
          label="Open approval gates"
          value={String(openApprovalCount)}
          detail={`Across ${approvalRuns.length} persisted run${approvalRuns.length === 1 ? "" : "s"} · display only`}
          tone={openApprovalCount > 0 ? "warning" : "default"}
        />
        <MetricTile
          label="Evidence health"
          value={`${evidenceLoaded}/5`}
          detail={`${unavailableEvidence.length} unavailable signal${unavailableEvidence.length === 1 ? "" : "s"} · ${unhealthyChecks.length} health alert${unhealthyChecks.length === 1 ? "" : "s"}`}
          tone={
            unavailableEvidence.length > 0 || unhealthyChecks.length > 0
              ? "warning"
              : "default"
          }
        />
      </div>

      <div
        aria-label="Mission Control sections"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-1.5"
      >
        {TABS.map((tab, index) => {
          const count =
            tab.id === "team"
              ? agents.length
              : tab.id === "runs"
                ? recentRuns.length
                : tab.id === "approvals"
                  ? approvalCount
                  : tab.id === "evidence"
                    ? evidenceLoaded
                    : null;
          return (
            <button
              key={tab.id}
              id={`ai-team-tab-${tab.id}`}
              ref={(node) => {
                tabButtonRefs.current[index] = node;
              }}
              type="button"
              aria-pressed={activeTab === tab.id}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "focus-ring flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors sm:px-4",
                activeTab === tab.id
                  ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
              )}
            >
              <MissionIcon name={tab.icon} className="size-4" />
              {tab.label}
              {count !== null ? (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                    activeTab === tab.id
                      ? "bg-[var(--accent-muted)] text-[var(--accent-light)]"
                      : "bg-[var(--surface-hover)] text-[var(--text-muted)]",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <div
          id="ai-team-panel-overview"
          className="space-y-5"
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <Card className="overflow-hidden" padding="none">
              <div className="border-b border-[var(--surface-border)] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-light)]">
                      Founder command
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                      Give the team an operating goal
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      The Chief of Staff routes the right specialists before creating a saved plan.
                    </p>
                  </div>
                  <Badge variant="default">Read-first</Badge>
                </div>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  {QUICK_GOALS.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => setGoal(template.goal)}
                      className="focus-ring rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--surface-border-strong)] hover:text-[var(--foreground)]"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label
                    htmlFor="ai-team-goal"
                    className="mb-2 block text-xs font-medium text-[var(--text-muted)]"
                  >
                    Goal
                  </label>
                  <textarea
                    id="ai-team-goal"
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    placeholder="What should the team investigate, challenge, or plan next?"
                    rows={5}
                    maxLength={1000}
                    className="focus-ring w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]/40"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>Planning only · no actions execute from this screen</span>
                    <span className="tabular-nums">{goal.length}/1000</span>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--background)]/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[var(--foreground)]">
                        Routing preview
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        Determined locally from the goal before submission.
                      </p>
                    </div>
                    {routedAgentIds.length > 0 ? (
                      <Badge variant="accent">{routedAgentIds.length} agents</Badge>
                    ) : null}
                  </div>
                  {routedAgentIds.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {routedAgentIds.map((id) => (
                        <AgentPill key={id} id={id} compact />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--text-muted)]">
                      Start typing or select a template to preview the routed team.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
                    <MissionIcon name="approval" className="mt-0.5 size-4 shrink-0 text-amber-300" />
                    Writes, deploys, payments, and customer actions remain approval-gated.
                  </div>
                  <Button
                    size="lg"
                    onClick={() => void createPlan()}
                    disabled={planning || goal.trim().length < 3}
                    className="shrink-0"
                  >
                    {planning ? "Coordinating team..." : "Create team plan"}
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-5">
              <Card padding="compact">
                <CardHeader
                  title="Operating signals"
                  description={`Evidence ${formatRelativeTime(snapshot?.generatedAt)}`}
                  action={
                    <Badge
                      variant={
                        unhealthyChecks.length > 0 || unavailableEvidence.length > 0
                          ? "warning"
                          : "success"
                      }
                    >
                      {unhealthyChecks.length > 0 || unavailableEvidence.length > 0
                        ? "Attention"
                        : "Healthy"}
                    </Badge>
                  }
                />
                <CardContent className="space-y-2.5">
                  {snapshot?.observations.slice(0, 4).map((observation) => (
                    <div
                      key={observation}
                      className="flex gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                        {observation}
                      </p>
                    </div>
                  ))}
                  {!snapshot?.observations.length ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      No live observations are available. The team will identify the evidence gap.
                    </p>
                  ) : null}
                  {unavailableEvidence.length > 0 ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
                      Unavailable: {unavailableEvidence.join(", ")}. Missing values will not be
                      inferred.
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card padding="compact">
                <CardHeader
                  title="Recent coordination"
                  description="Latest persisted team runs"
                  action={<Badge variant="default">{recentRuns.length}</Badge>}
                />
                <CardContent>
                  {recentRuns.length > 0 ? (
                    <div className="divide-y divide-[var(--surface-border)]">
                      {recentRuns.slice(0, 3).map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => setActiveTab("runs")}
                          className="focus-ring block w-full py-3 text-left first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="line-clamp-1 text-sm font-medium text-[var(--foreground)]">
                              {run.goal}
                            </p>
                            <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                              {formatRelativeTime(run.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {run.tasks.length} tasks ·{" "}
                            {run.tasks.filter((task) => task.requiresApproval).length} gated
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">
                      No runs yet. A saved coordination plan will appear here.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {plan ? (
            <Card>
              <CardHeader
                title="Current coordinated plan"
                description={plan.summary}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={plan.source === "ai" ? "success" : "default"}>
                      {plan.source === "ai" ? "AI runtime" : "Fallback"}
                    </Badge>
                    <Badge variant="accent">{plan.tasks.length} tasks</Badge>
                  </div>
                }
              />
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Founder goal
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{plan.goal}</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {plan.tasks.map((task) => (
                    <TaskDetail key={task.id} task={task} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[var(--surface-border)] pt-4">
                  {plan.guardrails.map((guardrail) => (
                    <Badge key={guardrail} variant="default" className="whitespace-normal py-1">
                      {guardrail}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="What the team can do next"
              description="Deterministic, read-only suggestions derived from the current evidence snapshot."
              action={<Badge variant="success">Safe actions</Badge>}
            />
            <CardContent>
              {suggestedActions.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {suggestedActions.map((action, index) => (
                    <div
                      key={action.title}
                      className="flex gap-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-xs font-semibold tabular-nums text-[var(--accent-light)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-[var(--foreground)]">
                            {action.title}
                          </h4>
                          <Badge variant="default">{AGENT_LABELS[action.owner]}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                          {action.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Refresh evidence to generate safe next-step suggestions.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "team" ? (
        <div
          id="ai-team-panel-team"
          className="space-y-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Operating team</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Eight purpose-built roles with explicit permissions and hard safety boundaries.
              </p>
            </div>
            <Badge variant={runtime?.mode === "ai" ? "success" : "accent"}>
              {runtime?.mode === "ai" ? "AI ready" : "Planner ready"}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => {
              const meta = AGENT_META[agent.id];
              return (
                <Card key={agent.id} padding="compact" className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconBadge tone={meta.tone}>
                        <MissionIcon name={meta.icon} />
                      </IconBadge>
                      <div>
                        <h4 className="font-semibold text-[var(--foreground)]">{agent.name}</h4>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {meta.categories.map((category) => (
                            <Badge key={category} variant="default">
                              {category}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Ready
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {agent.mission}
                  </p>

                  <div className="mt-5 space-y-4 border-t border-[var(--surface-border)] pt-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Permissions
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {agent.permissions.map((permission) => (
                          <li
                            key={permission}
                            className="flex gap-2 text-xs text-[var(--text-secondary)]"
                          >
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--accent)]" />
                            {permission}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Guardrails
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {agent.guardrails.map((guardrail) => (
                          <li
                            key={guardrail}
                            className="flex gap-2 text-xs text-[var(--text-muted)]"
                          >
                            <MissionIcon
                              name="approval"
                              className="mt-0.5 size-3.5 shrink-0 text-amber-300"
                            />
                            {guardrail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "runs" ? (
        <div
          id="ai-team-panel-runs"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Run history</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Expand a run to inspect its source, model, tasks, evidence, and approval gates.
              </p>
            </div>
            <Badge variant="default">Latest {recentRuns.length} saved</Badge>
          </div>
          {recentRuns.length > 0 ? (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="◫"
              title="No runs recorded yet"
              description="Create a founder goal from Overview. The resulting read-only plan and its evidence snapshot will be persisted here."
              action={
                <Button className="mt-6" onClick={() => setActiveTab("overview")}>
                  Open goal composer
                </Button>
              }
            />
          )}
        </div>
      ) : null}

      {activeTab === "approvals" ? (
        <div
          id="ai-team-panel-approvals"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  Approval-gated work
                </h3>
                <Badge variant="warning">Display only</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                All persisted tasks that require founder approval, grouped by run. Execution is not
                available in V2.
              </p>
            </div>
            <Badge variant={approvalCount > 0 ? "warning" : "success"}>
              {approvalCount} gated
            </Badge>
          </div>

          {approvalRuns.length > 0 ? (
            <div className="space-y-4">
              {approvalRuns.map((run) => (
                <Card key={run.id} padding="compact">
                  <CardHeader
                    title={run.goal}
                    description={`${formatDate(run.createdAt)} · ${run.source === "ai" ? "AI runtime" : "Fallback"} · ${shortModelName(run.model)}`}
                    action={<Badge variant="warning">{run.tasks.length} gated</Badge>}
                  />
                  <CardContent className="space-y-3">
                    {run.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <AgentPill id={task.owner} compact />
                          <Badge variant={statusVariant(task.status)} className="capitalize">
                            {formatStatus(task.status)}
                          </Badge>
                        </div>
                        <h4 className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                          {task.title}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                          {task.objective}
                        </p>
                        <div className="mt-3 border-t border-amber-500/15 pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                            Why approval is required
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                            {task.approvalReason ??
                              "Production-sensitive action requires explicit approval."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
              <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-xs text-[var(--text-muted)]">
                This view is an audit queue only. No approve, reject, or execute actions are exposed.
              </div>
            </div>
          ) : (
            <EmptyState
              icon="✓"
              title="No approval-gated tasks"
              description="There are no persisted AI Team tasks waiting at a production-safety gate."
            />
          )}
        </div>
      ) : null}

      {activeTab === "evidence" ? (
        <div
          id="ai-team-panel-evidence"
          className="space-y-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Evidence snapshot</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Current Buxme operating evidence captured {formatDate(snapshot?.generatedAt)}.
              </p>
            </div>
            <Badge variant={unavailableEvidence.length > 0 ? "warning" : "success"}>
              {evidenceLoaded}/5 sources loaded
            </Badge>
          </div>

          {unavailableEvidence.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <p className="text-xs font-semibold text-amber-200">Unavailable evidence</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                {unavailableEvidence.join(", ")}. Agents are instructed to disclose these gaps and
                never invent missing values.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot?.overview ? (
              <SourceCard title="Platform overview" status="live">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Total users", snapshot.overview.totalUsers],
                    ["Active · 7d", snapshot.overview.activeUsers7d],
                    ["Bug reports", snapshot.overview.totalBugReports],
                    ["Feedback", snapshot.overview.totalFeedbackReports],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[var(--surface-subtle)] p-3">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </SourceCard>
            ) : (
              <SourceCard title="Platform overview" status="unavailable">
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                  The overview query did not return usable data. Mission Control will keep this source visible instead of filling the gap with assumptions.
                </p>
              </SourceCard>
            )}

            {snapshot?.revenue ? (
              <SourceCard
                title="Revenue"
                status={snapshot.revenue.available ? "live" : "partial"}
              >
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["MRR", formatCurrency(snapshot.revenue.mrr)],
                    [
                      "Paid users",
                      String(snapshot.revenue.proUsers + snapshot.revenue.proPlusUsers),
                    ],
                    ["Churn · 30d", `${snapshot.revenue.churnRate}%`],
                    ["Failed payments", String(snapshot.revenue.failedPayments)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[var(--surface-subtle)] p-3">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        {label}
                      </p>
                      <p className="mt-1 text-base font-semibold tabular-nums text-[var(--foreground)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                {!snapshot.revenue.available ? (
                  <p className="mt-3 text-xs text-amber-200">
                    Stripe live data is unavailable; profile-backed values may be partial.
                  </p>
                ) : null}
              </SourceCard>
            ) : (
              <SourceCard title="Revenue" status="unavailable">
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                  Revenue evidence is unavailable right now. No MRR, subscriber, churn, or payment values are inferred.
                </p>
              </SourceCard>
            )}

            {snapshot?.plaid ? (
              <SourceCard title="Plaid" status={snapshot.plaid.available ? "live" : "partial"}>
                {snapshot.plaid.available ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Accounts", String(snapshot.plaid.connectedAccounts)],
                      ["Institutions", String(snapshot.plaid.connectedInstitutions)],
                      ["Sync success", `${snapshot.plaid.syncSuccessRate}%`],
                      ["Failed syncs", String(snapshot.plaid.failedSyncs)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-[var(--surface-subtle)] p-3">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                          {label}
                        </p>
                        <p className="mt-1 text-base font-semibold tabular-nums text-[var(--foreground)]">
                          {value}
                        </p>
                      </div>
                    ))}
                    <p className="col-span-2 text-xs text-[var(--text-muted)]">
                      Last sync: {formatDate(snapshot.plaid.lastSync)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-200">
                    Plaid live connection metrics are currently unavailable.
                  </p>
                )}
              </SourceCard>
            ) : (
              <SourceCard title="Plaid" status="unavailable">
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                  Plaid connection evidence is unavailable. Mission Control will not estimate account or sync health.
                </p>
              </SourceCard>
            )}

            {snapshot?.analytics ? (
              <SourceCard title="Analytics · latest points" status="live">
                <div className="space-y-2">
                  {(
                    [
                      ["Daily signups", snapshot.analytics.dailySignups],
                      ["Daily active users", snapshot.analytics.dailyActiveUsers],
                      ["Subscription growth", snapshot.analytics.subscriptionGrowth],
                      ["Revenue", snapshot.analytics.revenue],
                    ] as const
                  ).map(([label, series]) => {
                    const latest = series.at(-1);
                    return (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-subtle)] px-3 py-2"
                      >
                        <span className="text-xs text-[var(--text-muted)]">{label}</span>
                        <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                          {latest ? latest.value : "No points"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SourceCard>
            ) : (
              <SourceCard title="Analytics · latest points" status="unavailable">
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                  Analytics series are unavailable. No signup, activity, subscription, or revenue trends are inferred.
                </p>
              </SourceCard>
            )}

            {snapshot && snapshot.health.length > 0 ? (
              <SourceCard
                title="System health"
                status={unhealthyChecks.length > 0 ? "partial" : "live"}
              >
                <div className="space-y-2">
                  {snapshot.health.map((check) => (
                    <div
                      key={check.id}
                      className="flex items-start gap-3 rounded-lg bg-[var(--surface-subtle)] px-3 py-2"
                    >
                      <span
                        className={cn(
                          "mt-1 size-2 shrink-0 rounded-full",
                          check.status === "green"
                            ? "bg-emerald-400"
                            : check.status === "yellow"
                              ? "bg-amber-300"
                              : "bg-rose-400",
                        )}
                      />
                      <div>
                        <p className="text-xs font-medium text-[var(--foreground)]">
                          {check.label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                          {check.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SourceCard>
            ) : (
              <SourceCard
                title="System health"
                status={evidenceSourceStatus.health ? "partial" : "unavailable"}
              >
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                  {evidenceSourceStatus.health
                    ? "The health query completed but returned no checks."
                    : "System health evidence is unavailable. No service state is inferred."}
                </p>
              </SourceCard>
            )}
          </div>

          <Card>
            <CardHeader
              title="Current observations"
              description="Plain-language facts generated directly from the snapshot."
              action={<Badge variant="default">{snapshot?.observations.length ?? 0}</Badge>}
            />
            <CardContent>
              {snapshot?.observations.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {snapshot.observations.map((observation) => (
                    <div
                      key={observation}
                      className="flex gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
                    >
                      <MissionIcon
                        name="evidence"
                        className="mt-0.5 size-4 shrink-0 text-[var(--accent-light)]"
                      />
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        {observation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  No observations are available in the current snapshot.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
