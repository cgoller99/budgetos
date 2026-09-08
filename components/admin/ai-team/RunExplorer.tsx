"use client";

import { useState } from "react";
import { Badge, Button, EmptyState, Input, Select } from "@/components/ui";
import type { AiTeamRun, AiTeamTaskStatus } from "@/lib/ai-team/types";
import {
  AGENT_LABELS,
  AgentChip,
  formatDate,
  modelName,
  statusVariant,
} from "./shared";

function runMarkdown(run: AiTeamRun): string {
  return [
    `# AI Team Run`,
    "",
    `**Goal:** ${run.goal}`,
    `**Source:** ${run.source === "ai" ? "AI runtime" : "Deterministic fallback"}`,
    `**Model:** ${run.model ?? "No model used"}`,
    `**Created:** ${run.createdAt}`,
    "",
    "## Summary",
    run.summary,
    "",
    "## Tasks",
    ...run.tasks.flatMap((task) => [
      `### ${task.title}`,
      `- Owner: ${AGENT_LABELS[task.owner]}`,
      `- Status: ${task.status}`,
      `- Approval required: ${task.requiresApproval ? "Yes" : "No"}`,
      task.objective,
      ...task.evidence.map((item) => `- Evidence: ${item}`),
      "",
    ]),
  ].join("\n");
}

export function RunExplorer({ runs }: { runs: AiTeamRun[] }) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [model, setModel] = useState("all");
  const [agent, setAgent] = useState("all");
  const [copied, setCopied] = useState<string | null>(null);
  const models = [...new Set(runs.map((run) => run.model).filter(Boolean))] as string[];

  const query = search.trim().toLowerCase();
  const filtered = runs.filter(
    (run) =>
      (!query ||
        `${run.goal} ${run.summary}`.toLowerCase().includes(query)) &&
      (source === "all" || run.source === source) &&
      (model === "all" || run.model === model) &&
      (agent === "all" || run.tasks.some((task) => task.owner === agent)),
  );

  async function copy(run: AiTeamRun, kind: "markdown" | "json") {
    await navigator.clipboard.writeText(
      kind === "json" ? JSON.stringify(run, null, 2) : runMarkdown(run),
    );
    setCopied(`${run.id}-${kind}`);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Run Explorer</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Search the latest {runs.length} persisted runs and inspect verified metadata.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search runs"
          aria-label="Search runs"
          className="xl:col-span-2"
        />
        <Select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Run source">
          <option value="all">All sources</option>
          <option value="ai">AI runtime</option>
          <option value="fallback">Deterministic fallback</option>
        </Select>
        <Select value={model} onChange={(event) => setModel(event.target.value)} aria-label="Run model">
          <option value="all">All models</option>
          {models.map((value) => (
            <option key={value} value={value}>
              {modelName(value)}
            </option>
          ))}
        </Select>
        <Select value={agent} onChange={(event) => setAgent(event.target.value)} aria-label="Run agent">
          <option value="all">All agents</option>
          {Object.entries(AGENT_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="◫" title="No matching runs" description="Adjust filters or create a team plan." />
      ) : (
        <div className="space-y-3">
          {filtered.map((run) => {
            const statusCounts = Object.fromEntries(
              [
                "queued",
                "running",
                "needs_approval",
                "approved",
                "rejected",
                "completed",
                "failed",
              ].map(
                (status) => [
                  status,
                  run.tasks.filter((task) => task.status === status).length,
                ],
              ),
            );
            const approvalCount = run.tasks.filter((task) => task.requiresApproval).length;
            const routed = run.runtimeMetadata?.selectedSpecialists.length
              ? ([
                  "chief_of_staff",
                  ...run.runtimeMetadata.selectedSpecialists,
                  "critic",
                ] as const)
              : [...new Set(run.tasks.map((task) => task.owner))];
            const evidence = [...new Set(run.tasks.flatMap((task) => task.evidence))];

            return (
              <details
                key={run.id}
                className="group overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] open:border-[var(--surface-border-strong)]"
              >
                <summary className="focus-ring flex cursor-pointer list-none items-start justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={run.source === "ai" ? "success" : "default"}>
                        {run.source === "ai" ? "AI runtime" : "Deterministic fallback"}
                      </Badge>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDate(run.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-[var(--foreground)]">{run.goal}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{run.summary}</p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {run.tasks.length} tasks · {approvalCount} approvals · {modelName(run.model)}
                    </p>
                  </div>
                  <span aria-hidden className="text-[var(--text-muted)] transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <div className="space-y-5 border-t border-[var(--surface-border)] p-4 sm:p-5">
                  <div className="flex flex-wrap gap-2">
                    {routed.map((id) => <AgentChip key={id} id={id} />)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusCounts)
                      .filter(([, count]) => count > 0)
                      .map(([status, count]) => (
                        <Badge key={status} variant={statusVariant(status as AiTeamTaskStatus)}>
                          {status.replaceAll("_", " ")} {count}
                        </Badge>
                      ))}
                  </div>
                  {run.runtimeMetadata ? (
                    <div className="grid gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-2 lg:grid-cols-5">
                      <p className="text-xs text-[var(--text-muted)]">
                        Calls <strong className="block text-sm text-[var(--foreground)]">{run.runtimeMetadata.modelCallCount ?? "Not reported"}</strong>
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Duration <strong className="block text-sm text-[var(--foreground)]">{run.runtimeMetadata.durationMs} ms</strong>
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Input tokens <strong className="block text-sm text-[var(--foreground)]">{run.runtimeMetadata.inputTokens ?? "Not reported"}</strong>
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Output tokens <strong className="block text-sm text-[var(--foreground)]">{run.runtimeMetadata.outputTokens ?? "Not reported"}</strong>
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Total tokens <strong className="block text-sm text-[var(--foreground)]">{run.runtimeMetadata.totalTokens ?? "Not reported"}</strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      Runtime usage metadata was not recorded for this run.
                    </p>
                  )}
                  {run.runtimeMetadata?.criticSummary ? (
                    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4">
                      <p className="text-xs font-semibold text-[var(--foreground)]">Critic summary</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {run.runtimeMetadata.criticSummary}
                      </p>
                    </div>
                  ) : null}
                  <div className="grid gap-3 lg:grid-cols-2">
                    {run.tasks.map((task) => (
                      <article key={task.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <AgentChip id={task.owner} />
                          <Badge variant={statusVariant(task.status)}>{task.status.replaceAll("_", " ")}</Badge>
                        </div>
                        <h4 className="mt-3 text-sm font-semibold text-[var(--foreground)]">{task.title}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{task.objective}</p>
                      </article>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--foreground)]">Evidence ({evidence.length})</p>
                    {evidence.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {evidence.map((item) => <li key={item} className="text-xs text-[var(--text-muted)]">• {item}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">No task evidence persisted.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void copy(run, "markdown")}>
                      {copied === `${run.id}-markdown` ? "Copied" : "Copy Markdown"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void copy(run, "json")}>
                      {copied === `${run.id}-json` ? "Copied" : "Copy JSON"}
                    </Button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
