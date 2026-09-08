"use client";

import { Badge, Button } from "@/components/ui";
import {
  launchReadinessScore,
  operatingHealthScore,
  operatingSuggestions,
} from "@/lib/ai-team/intelligence";
import { selectAiTeamSpecialists } from "@/lib/ai-team/routing";
import type {
  AiTeamActivityEvent,
  AiTeamAgentId,
  AiTeamApprovalDecision,
  AiTeamPlanningUsage,
  AiTeamRun,
  AiTeamRuntimeInfo,
  AiTeamSnapshot,
} from "@/lib/ai-team/types";
import {
  AGENT_ICONS,
  AGENT_LABELS,
  BUILT_IN_PLAYBOOKS,
  formatDate,
  modelName,
  relativeTime,
} from "./shared";

type Props = {
  goal: string;
  setGoal: (goal: string) => void;
  createPlan: () => void;
  planning: boolean;
  activity: AiTeamActivityEvent[];
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
  runs: AiTeamRun[];
  approvalRuns: AiTeamRun[];
  decisions: AiTeamApprovalDecision[];
  planningUsage: AiTeamPlanningUsage;
  agentCount: number;
  onRefresh: () => void;
  refreshing: boolean;
};

const AGENT_POSITIONS: Record<AiTeamAgentId, string> = {
  chief_of_staff: "left-1/2 top-0 -translate-x-1/2",
  engineering: "right-[7%] top-[15%]",
  qa: "right-0 top-1/2 -translate-y-1/2",
  analytics: "bottom-[15%] right-[7%]",
  product: "bottom-0 left-1/2 -translate-x-1/2",
  growth: "bottom-[15%] left-[7%]",
  customer: "left-0 top-1/2 -translate-y-1/2",
  critic: "left-[7%] top-[15%]",
};

const AGENT_IDS = Object.keys(AGENT_LABELS) as AiTeamAgentId[];

function metric(value: number | null | undefined, suffix = ""): string {
  return typeof value === "number" ? `${value.toLocaleString()}${suffix}` : "Unavailable";
}

function activityTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusTone(status: AiTeamActivityEvent["status"]): string {
  if (status === "completed") return "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]";
  if (status === "failed") return "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.7)]";
  if (status === "warning") return "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.65)]";
  if (status === "running") return "animate-pulse bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.8)] motion-reduce:animate-none";
  return "bg-slate-500";
}

export function CommandCenter({
  goal,
  setGoal,
  createPlan,
  planning,
  activity,
  runtime,
  snapshot,
  runs,
  approvalRuns,
  decisions,
  planningUsage,
  agentCount,
  onRefresh,
  refreshing,
}: Props) {
  const specialists = goal.trim().length >= 3 ? selectAiTeamSpecialists(goal) : [];
  const routed = new Set<AiTeamAgentId>([
    ...(specialists.length > 0 ? specialists : []),
    ...(specialists.length > 0 ? (["chief_of_staff", "critic"] as const) : []),
  ]);
  const decided = new Set(decisions.map((decision) => decision.taskId));
  const openApprovals = approvalRuns
    .flatMap((run) => run.tasks)
    .filter(
      (task) =>
        task.requiresApproval &&
        task.status === "needs_approval" &&
        !decided.has(task.id),
    ).length;
  const healthyChecks = snapshot.health.filter((check) => check.status === "green").length;
  const latestEvent = activity.at(-1);
  const operationCompleted = activity.some(
    (event) => event.phase === "operation" && event.status === "completed",
  );
  const operationFailed = activity.some(
    (event) => event.phase === "operation" && event.status === "failed",
  );
  const coreState = operationFailed
    ? "error"
    : planning
      ? "active"
      : operationCompleted
        ? "complete"
        : "idle";
  const currentPhase =
    latestEvent?.label ??
    (planning ? "Initializing command" : "Awaiting founder command");
  const completedMilestones = new Set(
    activity
      .filter((event) => event.status === "completed")
      .map((event) => `${event.phase}:${event.agentId ?? "system"}`),
  ).size;
  const expectedMilestones = Math.max(1, specialists.length + 5);
  const progress = operationCompleted
    ? 100
    : Math.min(92, Math.round((completedMilestones / expectedMilestones) * 100));
  const lastRun = runs[0];
  const operating = operatingHealthScore(snapshot);
  const launch = launchReadinessScore(snapshot, runs, decisions, approvalRuns);
  const suggestions = operatingSuggestions(snapshot, runs);

  function agentState(
    id: AiTeamAgentId,
  ): "active" | "complete" | "failed" | "routed" | "idle" {
    const latest = activity.filter((event) => event.agentId === id).at(-1);
    if (latest?.status === "running") return "active";
    if (latest?.status === "completed") return "complete";
    if (latest?.status === "failed") return "failed";
    if (routed.has(id) && planning) return "routed";
    return "idle";
  }

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[#030812] text-slate-100 shadow-[0_30px_100px_rgba(1,8,20,0.45)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,189,248,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.055) 1px, transparent 1px), radial-gradient(circle at 35% 40%, rgba(14,165,233,.14), transparent 38%)",
            backgroundSize: "36px 36px, 36px 36px, 100% 100%",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
        <div className="pointer-events-none absolute -top-1/2 left-0 h-full w-full animate-[spin_24s_linear_infinite] bg-[conic-gradient(from_90deg,transparent_0_80%,rgba(56,189,248,.08)_92%,transparent)] motion-reduce:animate-none" />

        <header className="relative flex flex-wrap items-start justify-between gap-4 border-b border-cyan-200/10 px-5 py-5 sm:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">Mission Control V4</Badge>
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/65">
                <span className={`size-1.5 rounded-full ${runtime.mode === "ai" ? "bg-emerald-400" : "bg-amber-300"}`} />
                {runtime.mode === "ai" ? "Runtime online" : "Safe fallback"}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-[0.12em] text-white sm:text-2xl">
              BUXME INTELLIGENCE CORE
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Evidence-first coordination · planning only · no underlying action executes
            </p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="hidden sm:block">
              <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Evidence sync</p>
              <p className="mt-1 text-xs text-slate-300">{relativeTime(snapshot.generatedAt)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing || planning}>
              {refreshing ? "Syncing…" : "Refresh"}
            </Button>
          </div>
        </header>

        <div className="relative grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              {[
                ["Waiting on you", String(openApprovals), openApprovals === 1 ? "approval" : "approvals"],
                [
                  "System health",
                  snapshot.unavailableSources.includes("health")
                    ? "Unavailable"
                    : `${healthyChecks}/${snapshot.health.length}`,
                  "checks green",
                ],
                ["Revenue", snapshot.revenue?.available ? `$${snapshot.revenue.mrr.toLocaleString()}` : "Unavailable", "monthly recurring"],
                ["Users", metric(snapshot.overview?.totalUsers), "total profiles"],
                ["Plaid", snapshot.plaid?.available ? metric(snapshot.plaid.connectedAccounts) : "Unavailable", "connected accounts"],
              ].map(([label, value, detail], index) => (
                <div
                  key={label}
                  className={`rounded-xl border border-cyan-200/10 bg-slate-950/55 p-3 ${index === 0 ? "col-span-2 lg:col-span-1" : ""}`}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-white">{value}</p>
                  <p className="truncate text-[10px] text-slate-500">{detail}</p>
                </div>
              ))}
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[540px]" aria-label={`Intelligence core status: ${coreState}`}>
              <div className="absolute inset-[10%] rounded-full border border-cyan-300/10" />
              <div className="absolute inset-[18%] animate-[spin_18s_linear_infinite] rounded-full border border-dashed border-cyan-300/20 motion-reduce:animate-none" />
              <div className="absolute inset-[27%] animate-[spin_12s_linear_infinite_reverse] rounded-full border border-cyan-200/20 motion-reduce:animate-none" />
              <div className="absolute inset-[31%] rounded-full bg-cyan-400/5 blur-2xl" />

              {AGENT_IDS.map((id) => {
                const state = agentState(id);
                return (
                  <div
                    key={id}
                    className={`absolute z-20 flex w-20 flex-col items-center gap-1 ${AGENT_POSITIONS[id]}`}
                    aria-label={`${AGENT_LABELS[id]}: ${state}`}
                  >
                    <span
                      className={`grid size-9 place-items-center rounded-full border text-sm transition-all ${
                        state === "active"
                          ? "animate-pulse border-cyan-200/80 bg-cyan-300/20 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,.45)] motion-reduce:animate-none"
                          : state === "complete"
                            ? "border-emerald-300/45 bg-emerald-300/10 text-emerald-200"
                            : state === "failed"
                              ? "border-rose-300/50 bg-rose-300/10 text-rose-200"
                            : state === "routed"
                              ? "border-sky-300/30 bg-sky-300/10 text-sky-200"
                              : "border-slate-700/80 bg-slate-950/80 text-slate-600"
                      }`}
                    >
                      {AGENT_ICONS[id]}
                    </span>
                    <span className={`text-center text-[9px] leading-tight ${state === "idle" ? "text-slate-600" : "text-slate-300"}`}>
                      {AGENT_LABELS[id]}
                    </span>
                  </div>
                );
              })}

              <div
                className={`absolute inset-[35%] z-10 grid place-items-center rounded-full border bg-[#061423]/95 text-center shadow-[inset_0_0_35px_rgba(34,211,238,.12),0_0_45px_rgba(14,165,233,.12)] ${
                  coreState === "error"
                    ? "border-rose-400/60"
                    : coreState === "complete"
                      ? "border-emerald-300/55"
                      : coreState === "active"
                        ? "border-cyan-200/70"
                        : "border-cyan-300/20"
                }`}
              >
                <div className="px-3">
                  <span className={`mx-auto block size-2 rounded-full ${statusTone(latestEvent?.status ?? "pending")}`} />
                  <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/55">
                    {coreState}
                  </p>
                  <p className="mt-1 text-[11px] font-medium leading-tight text-white sm:text-xs" aria-live="polite">
                    {currentPhase}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200/15 bg-slate-950/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,.25)]">
              <div className="flex flex-wrap gap-2">
                {BUILT_IN_PLAYBOOKS.slice(0, 5).map((playbook) => (
                  <button
                    key={playbook.title}
                    type="button"
                    onClick={() => setGoal(playbook.goalTemplate)}
                    disabled={planning}
                    className="focus-ring rounded-full border border-cyan-200/10 bg-cyan-100/5 px-3 py-1.5 text-[10px] text-slate-400 transition hover:border-cyan-200/30 hover:text-cyan-100 disabled:opacity-40"
                  >
                    {playbook.title}
                  </button>
                ))}
              </div>
              <label htmlFor="ai-goal" className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
                Founder command
              </label>
              <textarea
                id="ai-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    createPlan();
                  }
                }}
                rows={4}
                maxLength={1000}
                placeholder="What should Mission Control investigate, challenge, or plan?"
                className="focus-ring mt-2 w-full resize-y rounded-xl border border-cyan-200/15 bg-[#020610]/85 p-4 text-sm leading-relaxed text-white outline-none placeholder:text-slate-600"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-slate-500">{goal.length}/1000 · Ctrl/Cmd+Enter</p>
                  <p className="mt-1 text-[10px] text-cyan-100/45">
                    {specialists.length > 0
                      ? `Routing: ${specialists.map((id) => AGENT_LABELS[id]).join(", ")}`
                      : "Enter a command to preview routing."}
                  </p>
                </div>
                <Button size="lg" onClick={createPlan} disabled={planning || goal.trim().length < 3}>
                  {planning ? "Core active…" : "Initialize command"}
                </Button>
              </div>
            </div>
          </div>

          <aside className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-cyan-200/15 bg-[#020610]/80">
            <div className="border-b border-cyan-200/10 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Live activity</h3>
                  <p className="mt-1 text-[10px] text-slate-500">Safe operational milestones from the active command</p>
                </div>
                <span className="rounded-full border border-cyan-200/10 bg-cyan-300/5 px-2 py-1 text-[9px] uppercase tracking-wider text-cyan-100/60">
                  {activity.length} events
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                <span>Operational progress · {completedMilestones} milestones confirmed</span>
                <span className="tabular-nums">{operationCompleted ? "Complete" : planning ? "In progress" : "Standby"}</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
                role="progressbar"
                aria-label="Operational progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                    operationFailed ? "bg-rose-400" : operationCompleted ? "bg-emerald-400" : "bg-cyan-300"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-[10px] text-slate-600">
                Operational trace — no hidden reasoning is displayed.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5" aria-live="polite" aria-label="Command activity trace">
              {activity.length > 0 ? (
                <ol className="space-y-0">
                  {activity.map((event, index) => (
                    <li key={event.id} className="relative grid grid-cols-[58px_14px_1fr] gap-2 pb-4">
                      {index < activity.length - 1 ? (
                        <span className="absolute bottom-0 left-[65px] top-4 w-px bg-cyan-200/10" aria-hidden />
                      ) : null}
                      <time className="pt-0.5 font-mono text-[9px] tabular-nums text-slate-600">
                        {activityTime(event.createdAt)}
                      </time>
                      <span className={`mt-1 size-2 rounded-full ${statusTone(event.status)}`} aria-hidden />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-medium text-slate-200">{event.label}</p>
                          <span className="text-[8px] font-semibold uppercase tracking-wider text-cyan-100/35">
                            {event.agentId ? AGENT_LABELS[event.agentId] : event.phase}
                          </span>
                        </div>
                        {event.detail ? (
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{event.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="grid h-full min-h-64 place-items-center text-center">
                  <div>
                    <span className="mx-auto block size-2 rounded-full bg-cyan-300/35" />
                    <p className="mt-3 text-xs text-slate-400">Core standing by</p>
                    <p className="mt-1 text-[10px] text-slate-600">Activity appears here when a command starts.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-cyan-200/10 bg-cyan-300/[0.025] p-4 sm:p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600">Last completed command</p>
              {lastRun ? (
                <>
                  <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-200">{lastRun.goal}</p>
                  <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-slate-500">{lastRun.summary}</p>
                  <p className="mt-2 text-[9px] text-slate-600">
                    {lastRun.tasks.length} tasks · {formatDate(lastRun.createdAt)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-600">No completed command is available.</p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Core readiness</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Deterministic from current evidence.</p>
            </div>
            <Badge variant={operating.score >= 80 ? "success" : "warning"}>{operating.score}/100</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Operating health", operating.score],
              ["Launch readiness", launch.score],
            ].map(([label, score]) => (
              <div key={label} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3">
                <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">{score}/100</p>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-[var(--text-muted)]">
            {agentCount} agents · planning {planningUsage.used}/{planningUsage.limit} today · {modelName(runtime.orchestratorModel)}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Operating suggestions</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Evidence-backed command starters; selecting one never auto-runs.</p>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">{formatDate(snapshot.generatedAt)}</span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {suggestions.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion.title}
                type="button"
                onClick={() => setGoal(suggestion.goal)}
                className="focus-ring rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-left transition-colors hover:border-[var(--surface-border-strong)]"
              >
                <span className="text-xs font-semibold text-[var(--foreground)]">{suggestion.title}</span>
                <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-[var(--text-muted)]">{suggestion.goal}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
