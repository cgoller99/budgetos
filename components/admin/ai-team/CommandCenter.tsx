"use client";

export { CommandCenter } from "./CommandCenterV4";

import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import {
  launchReadinessScore,
  operatingHealthScore,
  operatingSuggestions,
} from "@/lib/ai-team/intelligence";
import { selectAiTeamSpecialists } from "@/lib/ai-team/routing";
import type {
  AiTeamAgentId,
  AiTeamApprovalDecision,
  AiTeamPlanningUsage,
  AiTeamRun,
  AiTeamRuntimeInfo,
  AiTeamSnapshot,
} from "@/lib/ai-team/types";
import {
  AgentChip,
  BUILT_IN_PLAYBOOKS,
  MiniStat,
  formatDate,
  modelName,
  relativeTime,
} from "./shared";

type Props = {
  goal: string;
  setGoal: (goal: string) => void;
  createPlan: () => void;
  planning: boolean;
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

function ScoreCard({
  title,
  score,
  contributors,
  missing,
}: {
  title: string;
  score: number;
  contributors: string[];
  missing: string[];
}) {
  return (
    <Card padding="compact">
      <CardHeader
        title={title}
        action={
          <Badge variant={score >= 80 ? "success" : score >= 55 ? "warning" : "danger"}>
            {score}/100
          </Badge>
        }
      />
      <CardContent>
        <div
          className="h-2 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
        <ul className="mt-4 space-y-1.5">
          {contributors.map((item) => (
            <li key={item} className="text-xs text-[var(--text-secondary)]">
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Missing: {missing.length > 0 ? missing.join(", ") : "none"}
        </p>
      </CardContent>
    </Card>
  );
}

export function LegacyCommandCenter({
  goal,
  setGoal,
  createPlan,
  planning,
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
  const routed: AiTeamAgentId[] =
    specialists.length > 0
      ? ["chief_of_staff", ...specialists, "critic"]
      : [];
  const operating = operatingHealthScore(snapshot);
  const launch = launchReadinessScore(snapshot, runs, decisions, approvalRuns);
  const suggestions = operatingSuggestions(snapshot, runs);
  const decided = new Set(decisions.map((decision) => decision.taskId));
  const allTasks = runs.flatMap((run) => run.tasks);
  const openApprovals = approvalRuns.flatMap((run) => run.tasks).filter(
    (task) =>
      task.requiresApproval &&
      task.status === "needs_approval" &&
      !decided.has(task.id),
  ).length;
  const openWork = allTasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.status !== "failed" &&
      task.status !== "rejected",
  ).length;
  const healthySources = operating.contributors[0]?.split("/")[0] ?? "0";
  const risks = [
    ...snapshot.health
      .filter((check) => check.status !== "green")
      .map((check) => check.label),
    ...operating.missingEvidence.map((source) => `${source} evidence unavailable`),
    ...(openApprovals > 0 ? [`${openApprovals} approval decisions pending`] : []),
  ].slice(0, 4);
  const activity = [
    ...runs.slice(0, 5).map((run) => ({
      id: run.id,
      at: run.createdAt,
      title: run.goal,
      detail: `${run.source === "ai" ? "AI" : "Deterministic fallback"} · ${run.tasks.length} tasks`,
    })),
    ...decisions.slice(0, 5).map((decision) => ({
      id: decision.id,
      at: decision.createdAt,
      title: `${decision.decision === "approved" ? "Approved" : "Rejected"} gated task`,
      detail: `Decision recorded by ${decision.actorEmail ?? decision.actorId}`,
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">AI Team V3</Badge>
              <Badge variant={runtime.mode === "ai" ? "success" : "warning"}>
                {runtime.mode === "ai" ? "Runtime online" : "Safe fallback"}
              </Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Executive Command Center
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Evidence-first planning plus dedicated execution, product analytics,
              revenue, customer voice, and founder brief centers. Decisions can be
              recorded, but no underlying action executes from Mission Control.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[440px]">
            <div className="rounded-xl border border-[var(--surface-border)] bg-black/10 p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Orchestrator
              </p>
              <p className="mt-1 truncate text-sm text-[var(--foreground)]">
                {modelName(runtime.orchestratorModel)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--surface-border)] bg-black/10 p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Specialists
              </p>
              <p className="mt-1 truncate text-sm text-[var(--foreground)]">
                {modelName(runtime.specialistModel)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-black/10 p-3 sm:col-span-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  Evidence freshness
                </p>
                <p className="mt-1 text-sm text-[var(--foreground)]">
                  {relativeTime(snapshot.generatedAt)} · {formatDate(snapshot.generatedAt)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Agents" value={agentCount} detail="8 operating roles" />
        <MiniStat label="Recent runs" value={runs.length} detail="Bounded history" />
        <MiniStat label="Open approvals" value={openApprovals} detail="Undecided only" />
        <MiniStat label="Open work" value={openWork} detail="Persisted tasks" />
        <MiniStat label="Evidence" value={`${healthySources}/5`} detail="Healthy sources" />
        <MiniStat
          label="Daily planning"
          value={`${planningUsage.used}/${planningUsage.limit}`}
          detail="Durable limit"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ScoreCard
          title="Launch Readiness"
          score={launch.score}
          contributors={launch.contributors}
          missing={launch.missingEvidence}
        />
        <ScoreCard
          title="Operating Health"
          score={operating.score}
          contributors={operating.contributors}
          missing={operating.missingEvidence}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader
            title="Goal composer"
            description="Ctrl/Cmd+Enter creates a saved plan. Choosing a template never auto-runs."
            action={<Badge variant="default">Planning only</Badge>}
          />
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {BUILT_IN_PLAYBOOKS.slice(0, 5).map((playbook) => (
                <button
                  key={playbook.title}
                  type="button"
                  onClick={() => setGoal(playbook.goalTemplate)}
                  className="focus-ring rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--foreground)]"
                >
                  {playbook.title}
                </button>
              ))}
            </div>
            <label className="block text-xs font-medium text-[var(--text-muted)]" htmlFor="ai-goal">
              Founder goal
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
              rows={5}
              maxLength={1000}
              placeholder="What should the team investigate, challenge, or plan?"
              className="focus-ring w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-muted)]">
                {goal.length}/1000 · no actions execute
              </span>
              <Button
                size="lg"
                onClick={createPlan}
                disabled={planning || goal.trim().length < 3}
              >
                {planning ? "Coordinating…" : "Create team plan"}
              </Button>
            </div>
            <div className="rounded-xl border border-[var(--surface-border)] bg-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--foreground)]">Routing preview</p>
                <Badge variant="accent">
                  {runtime.mode === "ai" ? `${specialists.length + 2} expected calls` : "0 model calls"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {routed.length > 0 ? (
                  routed.map((id) => <AgentChip key={id} id={id} />)
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">Enter a goal to route the team.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Executive Brief" description="Deterministic from current evidence and recent runs." />
          <CardContent className="space-y-4">
            {[
              ["Top signals", snapshot.observations.slice(0, 3)],
              ["Risks", risks.length > 0 ? risks : ["No evidenced risks in the current snapshot."]],
              ["Opportunities", suggestions.slice(0, 2).map((item) => item.title)],
              ["Next moves", suggestions.slice(0, 2).map((item) => item.goal)],
            ].map(([title, items]) => (
              <div key={title as string}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {title}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {(items as string[]).map((item) => (
                    <li key={item} className="text-xs leading-relaxed text-[var(--text-secondary)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Operating suggestions" description="Ranked, deterministic, safe planning prompts." />
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.title}
                type="button"
                onClick={() => setGoal(suggestion.goal)}
                className="focus-ring rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4 text-left transition-colors hover:border-[var(--surface-border-strong)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {suggestion.title}
                  </span>
                  <Badge variant={suggestion.severity === "high" ? "warning" : "default"}>
                    {suggestion.severity}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                  {suggestion.goal}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Recent activity" description="Runs and immutable approval decisions." />
        <CardContent>
          {activity.length > 0 ? (
            <ol className="space-y-3">
              {activity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--accent)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--foreground)]">{item.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {item.detail} · {relativeTime(item.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
