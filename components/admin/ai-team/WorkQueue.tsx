"use client";

import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Input, Select } from "@/components/ui";
import type {
  AiTeamApprovalDecision,
  AiTeamRun,
  AiTeamTask,
} from "@/lib/ai-team/types";
import {
  AGENT_LABELS,
  AgentChip,
  DecisionBadge,
  statusVariant,
} from "./shared";

type WorkItem = {
  task: AiTeamTask;
  run: AiTeamRun;
  decision?: AiTeamApprovalDecision;
  priority: number;
};

function priorityFor(task: AiTeamTask): number {
  if (task.status === "failed") return 4;
  if (task.requiresApproval && task.status === "needs_approval") return 3;
  if (task.status === "running") return 2;
  if (task.status === "queued") return 1;
  return 0;
}

function priorityLabel(priority: number): string {
  if (priority >= 4) return "critical";
  return ["low", "normal", "high", "critical"][priority] ?? "normal";
}

function executionBrief(item: WorkItem): string {
  return [
    `# ${item.task.title}`,
    "",
    `- Owner: ${AGENT_LABELS[item.task.owner]}`,
    `- Status: ${item.task.status.replaceAll("_", " ")}`,
    `- Run goal: ${item.run.goal}`,
    `- Requires approval: ${item.task.requiresApproval ? "Yes" : "No"}`,
    item.task.approvalReason
      ? `- Approval reason: ${item.task.approvalReason}`
      : null,
    item.decision ? `- Decision: ${item.decision.decision}` : null,
    "",
    "## Objective",
    item.task.objective,
    "",
    "## Evidence",
    ...(item.task.evidence.length > 0
      ? item.task.evidence.map((evidence) => `- ${evidence}`)
      : ["- No evidence recorded."]),
    "",
    "> Planning brief only. Copying this text does not execute any action.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function WorkQueue({
  runs,
  decisions,
}: {
  runs: AiTeamRun[];
  decisions: AiTeamApprovalDecision[];
}) {
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [status, setStatus] = useState("all");
  const [approval, setApproval] = useState("all");
  const [sort, setSort] = useState("newest");
  const [copied, setCopied] = useState<string | null>(null);

  const items = useMemo(() => {
    const decisionsByTask = new Map(decisions.map((item) => [item.taskId, item]));
    const query = search.trim().toLowerCase();
    const result: WorkItem[] = runs.flatMap((run) =>
      run.tasks.map((task) => ({
        task,
        run,
        decision: decisionsByTask.get(task.id),
        priority: priorityFor(task),
      })),
    );

    return result
      .filter(
        (item) =>
          (!query ||
            `${item.task.title} ${item.task.objective} ${item.run.goal}`
              .toLowerCase()
              .includes(query)) &&
          (owner === "all" || item.task.owner === owner) &&
          (status === "all" || item.task.status === status) &&
          (approval === "all" ||
            (approval === "none" && !item.task.requiresApproval) ||
            (approval === "pending" &&
              item.task.requiresApproval &&
              !item.decision) ||
            (approval === "decided" && Boolean(item.decision))),
      )
      .sort((a, b) => {
        if (sort === "priority") return b.priority - a.priority;
        const delta = Date.parse(b.run.createdAt) - Date.parse(a.run.createdAt);
        return sort === "oldest" ? -delta : delta;
      });
  }, [approval, decisions, owner, runs, search, sort, status]);

  async function copy(item: WorkItem) {
    await navigator.clipboard.writeText(executionBrief(item));
    setCopied(item.task.id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const content = (item: WorkItem) =>
    [
      <div key="work" className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-[var(--foreground)]">{item.task.title}</p>
          <Badge variant={statusVariant(item.task.status)}>
            {item.task.status.replaceAll("_", " ")}
          </Badge>
          <Badge variant={item.priority >= 3 ? "warning" : "default"}>
            {priorityLabel(item.priority)}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          {item.task.objective}
        </p>
        <p className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">
          Goal: {item.run.goal}
        </p>
      </div>,
      <div key="owner" className="space-y-2">
        <AgentChip id={item.task.owner} />
        <p className="text-xs text-[var(--text-muted)]">
          {item.task.evidence.length} evidence item
          {item.task.evidence.length === 1 ? "" : "s"}
        </p>
        {item.task.requiresApproval ? (
          <>
            <DecisionBadge decision={item.decision?.decision} />
            <p className="text-xs leading-relaxed text-amber-200/80">
              {item.task.approvalReason}
            </p>
          </>
        ) : (
          <Badge variant="default">No approval gate</Badge>
        )}
      </div>,
      <Button key="copy" variant="secondary" size="sm" onClick={() => void copy(item)}>
        {copied === item.task.id ? "Copied" : "Copy execution brief"}
      </Button>,
    ] as const;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Work Queue</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Persisted tasks from the latest bounded run history. Nothing executes here.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search work"
          aria-label="Search work queue"
          className="xl:col-span-2"
        />
        <Select value={owner} onChange={(event) => setOwner(event.target.value)} aria-label="Owner">
          <option value="all">All owners</option>
          {Object.entries(AGENT_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          {[
            "queued",
            "running",
            "needs_approval",
            "approved",
            "rejected",
            "completed",
            "failed",
          ].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
        <Select value={approval} onChange={(event) => setApproval(event.target.value)} aria-label="Approval">
          <option value="all">All approvals</option>
          <option value="pending">Pending decision</option>
          <option value="decided">Decided</option>
          <option value="none">No approval gate</option>
        </Select>
      </div>
      <div className="flex justify-end">
        <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort work">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">Priority</option>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="□" title="No matching work" description="Adjust filters or create a new team plan." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-[var(--surface-border)] lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="w-[44%] px-4 py-3 font-medium">Work</th>
                  <th className="w-[25%] px-4 py-3 font-medium">Owner / evidence</th>
                  <th className="w-[16%] px-4 py-3 font-medium">Approval</th>
                  <th className="w-[15%] px-4 py-3 font-medium">Brief</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.task.id} className="border-t border-[var(--surface-border)] align-top">
                    {[
                      <td key="work" className="px-4 py-4">{content(item)[0]}</td>,
                      <td key="owner" className="px-4 py-4">{content(item)[1]}</td>,
                      <td key="approval" className="px-4 py-4">
                        {item.task.requiresApproval ? <DecisionBadge decision={item.decision?.decision} /> : "—"}
                      </td>,
                      <td key="brief" className="px-4 py-4">{content(item)[2]}</td>,
                    ]}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 lg:hidden">
            {items.map((item) => (
              <article
                key={item.task.id}
                className="grid gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4"
              >
                {content(item)}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
