"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import type {
  AiTeamAgent,
  AiTeamAgentId,
  AiTeamPlan,
  AiTeamRun,
  AiTeamRuntimeInfo,
  AiTeamSnapshot,
  AiTeamTaskStatus,
} from "@/lib/ai-team/types";

type AiTeamGetPayload = {
  agents: AiTeamAgent[];
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
  recentRuns: AiTeamRun[];
};

type AiTeamPostPayload = {
  plan: AiTeamPlan;
  run: AiTeamRun;
  runtime: AiTeamRuntimeInfo;
  snapshot: AiTeamSnapshot;
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

export function AdminAiTeamSection() {
  const [agents, setAgents] = useState<AiTeamAgent[]>([]);
  const [runtime, setRuntime] = useState<AiTeamRuntimeInfo | null>(null);
  const [snapshot, setSnapshot] = useState<AiTeamSnapshot | null>(null);
  const [plan, setPlan] = useState<AiTeamPlan | null>(null);
  const [recentRuns, setRecentRuns] = useState<AiTeamRun[]>([]);
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadAiTeam = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai-team");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to load AI Team.");
      }

      const payload = (await response.json()) as AiTeamGetPayload;
      setAgents(payload.agents);
      setRuntime(payload.runtime);
      setSnapshot(payload.snapshot);
      setRecentRuns(payload.recentRuns);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load AI Team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAiTeam();
  }, [loadAiTeam]);
  async function createPlan() {
    const trimmed = goal.trim();
    if (trimmed.length < 3) return;

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
      setRecentRuns((current) => [
        payload.run,
        ...current.filter((run) => run.id !== payload.run.id),
      ].slice(0, 20));
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to create plan.");
    } finally {
      setPlanning(false);
    }
  }
  return (
    <section id="ai-team" className="scroll-mt-28 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
              AI Team
            </h2>
            <Badge variant="accent">V1</Badge>
            <Badge variant={runtime?.mode === "ai" ? "success" : "warning"}>
              {runtime?.mode === "ai" ? "AI runtime online" : "Fallback mode"}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
            A read-first operating layer for Buxme. Agents use available evidence, coordinate work,
            and stop at approval gates before production-sensitive actions.
          </p>
          {runtime ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Specialists: {runtime.specialistModel} · Chief: {runtime.orchestratorModel}
            </p>
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadAiTeam()}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh evidence"}
        </Button>
      </div>
      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {agents.map((agent) => (
          <Card key={agent.id} padding="compact">
            <CardHeader
              title={agent.name}
              description={agent.mission}
              action={
                <Badge variant={runtime?.mode === "ai" ? "success" : "default"}>
                  {runtime?.mode === "ai" ? "AI ready" : "Planner ready"}
                </Badge>
              }
            />
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Can do
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {agent.permissions.join(" · ")}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Guardrail
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {agent.guardrails[0]}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader
            title="Give the team a goal"
            description="The Chief of Staff converts it into evidence-backed specialist tasks."
          />
          <CardContent className="space-y-4">
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Example: Find the biggest launch risk and tell me what we should fix first."
              rows={5}
              maxLength={1000}
              className="focus-ring w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                Production writes, payments, customer actions, and deploys are approval-gated.
              </p>
              <Button
                onClick={() => void createPlan()}
                disabled={planning || goal.trim().length < 3}
              >
                {planning ? "Coordinating..." : "Create team plan"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Observed right now"
            description={
              snapshot
                ? "Evidence refreshed " + new Date(snapshot.generatedAt).toLocaleTimeString()
                : "Waiting for admin data"
            }
          />
          <CardContent className="space-y-3">
            {snapshot?.observations.length ? (
              snapshot.observations.map((observation) => (
                <div
                  key={observation}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  {observation}
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                {loading ? "Loading evidence..." : "No live observations are available yet."}
              </p>
            )}

            {snapshot?.unavailableSources.length ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Unavailable sources: {snapshot.unavailableSources.join(", ")}. Agents must not infer
                missing values.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card padding="compact">
        <CardHeader
          title="Recent runs"
          description="The latest 20 saved plans and their approval gates."
          action={<Badge variant="default">{recentRuns.length} saved</Badge>}
        />
        <CardContent>
          {recentRuns.length ? (
            <div className="divide-y divide-[var(--surface-border)]">
              {recentRuns.map((run) => {
                const approvalCount = run.tasks.filter(
                  (task) => task.requiresApproval,
                ).length;

                return (
                  <div
                    key={run.id}
                    className="grid gap-2 py-3 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <time
                          dateTime={run.createdAt}
                          className="text-xs text-[var(--text-muted)]"
                        >
                          {new Date(run.createdAt).toLocaleString()}
                        </time>
                        <Badge variant={run.source === "ai" ? "success" : "default"}>
                          {run.source === "ai" ? "AI" : "Fallback"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                        {run.goal}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {run.summary}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Badge variant="accent">{run.tasks.length} tasks</Badge>
                      <Badge variant={approvalCount > 0 ? "warning" : "default"}>
                        {approvalCount} approvals
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              {loading ? "Loading run history..." : "No AI Team runs have been saved yet."}
            </p>
          )}
        </CardContent>
      </Card>

      {plan ? (
        <Card>
          <CardHeader
            title="Current coordinated plan"
            description={plan.summary}
            action={
              <div className="flex items-center gap-2">
                <Badge variant={plan.source === "ai" ? "success" : "default"}>
                  {plan.source === "ai" ? "AI" : "Fallback"}
                </Badge>
                <Badge variant="accent">{plan.tasks.length} tasks</Badge>
              </div>
            }
          />
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Goal
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{plan.goal}</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {plan.tasks.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="accent">{AGENT_LABELS[item.owner]}</Badge>
                    <Badge variant={statusVariant(item.status)}>
                      {formatStatus(item.status)}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.objective}</p>

                  {item.evidence.length ? (
                    <div className="mt-3 border-t border-[var(--surface-border)] pt-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Evidence
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{item.evidence[0]}</p>
                    </div>
                  ) : null}

                  {item.requiresApproval ? (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Approval gate: {item.approvalReason ?? "Production-sensitive action."}
                    </div>
                  ) : null}
                </div>
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
    </section>
  );
}
