"use client";

import { Badge, Card, CardContent, CardHeader, EmptyState } from "@/components/ui";
import { evidenceAvailability } from "@/lib/ai-team/intelligence";
import { selectAiTeamSpecialists } from "@/lib/ai-team/routing";
import type { AiTeamAgent, AiTeamSnapshot } from "@/lib/ai-team/types";
import { AGENT_ICONS, formatDate } from "./shared";

function availableFieldNames(source: string, value: unknown): string[] {
  if (
    source === "revenue" &&
    value &&
    typeof value === "object" &&
    "available" in value &&
    value.available === false
  ) {
    return ["freeUsers", "proUsers", "proPlusUsers"];
  }
  if (
    source === "plaid" &&
    value &&
    typeof value === "object" &&
    "available" in value &&
    value.available === false
  ) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.length > 0 && value[0] && typeof value[0] === "object"
      ? Object.keys(value[0])
      : [];
  }
  return value && typeof value === "object" ? Object.keys(value) : [];
}

export function EvidenceCenter({ snapshot }: { snapshot: AiTeamSnapshot }) {
  const availability = evidenceAvailability(snapshot);
  const sources = [
    { id: "overview", label: "Platform overview", value: snapshot.overview },
    { id: "revenue", label: "Revenue / Stripe", value: snapshot.revenue },
    { id: "plaid", label: "Plaid", value: snapshot.plaid },
    { id: "analytics", label: "Analytics", value: snapshot.analytics },
    { id: "health", label: "System health", value: snapshot.health },
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Evidence Center</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Snapshot captured {formatDate(snapshot.generatedAt)}. Missing values are never inferred.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => {
          const available = availability[source.id];
          const status =
            source.id === "revenue" && source.value && !source.value.available
              ? "partial"
              : source.id === "health" &&
                  available &&
                  snapshot.health.some((check) => check.status !== "green")
                ? "partial"
                : available
                  ? "healthy"
                  : "unavailable";
          const fields = availableFieldNames(source.id, source.value);
          return (
            <Card key={source.id} padding="compact">
              <CardHeader
                title={source.label}
                action={
                  <Badge variant={status === "healthy" ? "success" : status === "partial" ? "warning" : "danger"}>
                    {status}
                  </Badge>
                }
              />
              <CardContent className="space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Freshness: {formatDate(snapshot.generatedAt)}
                </p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Available fields
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {fields.length > 0
                      ? fields.map((field) => (
                          <Badge key={field} variant="default">{field}</Badge>
                        ))
                      : <span className="text-xs text-[var(--text-muted)]">None</span>}
                  </div>
                </div>
                <details>
                  <summary className="focus-ring cursor-pointer rounded-lg text-xs text-[var(--accent-light)]">
                    Inspect source data
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-black/20 p-3 text-[11px] text-[var(--text-secondary)]">
                    {JSON.stringify(source.value, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Observations" action={<Badge variant="default">{snapshot.observations.length}</Badge>} />
          <CardContent>
            {snapshot.observations.length > 0 ? (
              <ul className="space-y-2">
                {snapshot.observations.map((item) => (
                  <li key={item} className="text-sm leading-relaxed text-[var(--text-secondary)]">• {item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No observations available.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Data gaps" action={<Badge variant={snapshot.unavailableSources.length ? "warning" : "success"}>{snapshot.unavailableSources.length}</Badge>} />
          <CardContent>
            {snapshot.unavailableSources.length > 0 ? (
              <ul className="space-y-2">
                {snapshot.unavailableSources.map((item) => (
                  <li key={item} className="text-sm text-amber-200">• {item} is unavailable</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No query-level source failures reported.</p>
            )}
            {snapshot.revenue && !snapshot.revenue.available ? (
              <p className="mt-2 text-sm text-amber-200">• Stripe live revenue is partial or unavailable</p>
            ) : null}
            {snapshot.plaid && !snapshot.plaid.available ? (
              <p className="mt-2 text-sm text-amber-200">• Plaid live connection data is unavailable</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <details className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
        <summary className="focus-ring cursor-pointer rounded-lg text-sm font-medium text-[var(--foreground)]">
          Raw snapshot JSON · admin debugging
        </summary>
        <pre className="mt-4 max-h-[32rem] overflow-auto rounded-xl bg-black/20 p-4 text-xs text-[var(--text-secondary)]">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AgentDirectory({
  agents,
  goal,
}: {
  agents: AiTeamAgent[];
  goal: string;
}) {
  const specialists = goal.trim().length >= 3 ? selectAiTeamSpecialists(goal) : [];
  const selected = new Set(["chief_of_staff", ...specialists, "critic"]);

  if (agents.length === 0) {
    return <EmptyState icon="◇" title="No agents available" description="Refresh Mission Control." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Agent Directory</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Eight roles, explicit boundaries, and deterministic routing for the typed goal.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const isSelected = selected.has(agent.id) && goal.trim().length >= 3;
          const matched = agent.routeKeywords.filter((keyword) =>
            goal.toLowerCase().includes(keyword.toLowerCase()),
          );
          const why =
            agent.id === "chief_of_staff"
              ? "Always orchestrates a submitted goal."
              : agent.id === "critic"
                ? "Always reviews specialist briefs before final synthesis."
                : agent.id === "analytics"
                  ? "Analytics is the default evidence specialist."
                  : isSelected
                    ? `Goal matched ${matched.join(", ") || "this role's routing patterns"}.`
                    : "No matching route keywords in the current goal.";
          return (
            <Card key={agent.id} padding="compact">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-light)]" aria-hidden>
                    {AGENT_ICONS[agent.id]}
                  </span>
                  <div>
                    <h4 className="font-semibold text-[var(--foreground)]">{agent.name}</h4>
                    <p className="text-xs capitalize text-[var(--text-muted)]">{agent.roleClass}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant="default">{agent.costAwareness}</Badge>
                  {isSelected ? <Badge variant="success">Selected</Badge> : null}
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{agent.mission}</p>
              <div className="mt-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Why routed</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{why}</p>
              </div>
              {[
                ["Capabilities", agent.capabilities],
                ["Route keywords", agent.routeKeywords],
                ["Permissions", agent.permissions],
                ["Guardrails", agent.guardrails],
              ].map(([label, values]) => (
                <div key={label as string} className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                  <ul className="mt-1.5 space-y-1">
                    {(values as string[]).map((value) => (
                      <li key={value} className="text-xs text-[var(--text-secondary)]">• {value}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
