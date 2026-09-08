"use client";

import { Badge, Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import type { AiTeamCustomerVoice } from "@/lib/ai-team/types";
import { MiniStat, formatDate } from "./shared";

type Props = {
  data: AiTeamCustomerVoice | null;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
};

function CountList({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </p>
      <div className="mt-2 space-y-1">
        {entries.length ? (
          entries.map(([label, count]) => (
            <p
              key={label}
              className="flex justify-between gap-3 text-sm text-[var(--text-secondary)]"
            >
              <span>{label.replaceAll("_", " ")}</span>
              <span className="tabular-nums text-[var(--foreground)]">
                {count}
              </span>
            </p>
          ))
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No signals</p>
        )}
      </div>
    </div>
  );
}

export function CustomerVoiceCenter({
  data,
  onRefresh,
  loading,
  error,
}: Props) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Customer Voice
          </h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Deterministic themes from submitted feedback and bug reports. No
            outreach is initiated here.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {error ? (
        <p
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
          <LoadingSkeleton lines={6} />
        </div>
      ) : !data ? (
        <EmptyState
          icon="◌"
          title="Customer voice unavailable"
          description="Refresh to load submitted customer signals."
        />
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h4 className="font-semibold text-[var(--foreground)]">
                Signal overview
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                Generated {formatDate(data.generatedAt)}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                label="Signals"
                value={data.total}
                detail="Submitted reports"
              />
              <MiniStat
                label="Themes"
                value={data.themes.length}
                detail="Deterministic groups"
              />
              <MiniStat
                label="Urgent"
                value={data.counts.byPriority.urgent ?? 0}
                detail="Priority signals"
              />
              <MiniStat
                label="New"
                value={data.counts.byStatus.new ?? 0}
                detail="Untriaged signals"
              />
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5 sm:grid-cols-2 xl:grid-cols-4">
            <CountList title="By type" values={data.counts.byType} />
            <CountList title="By category" values={data.counts.byCategory} />
            <CountList title="By status" values={data.counts.byStatus} />
            <CountList title="By priority" values={data.counts.byPriority} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
              <h4 className="font-semibold text-[var(--foreground)]">
                Themes
              </h4>
              <div className="mt-3 space-y-2">
                {data.themes.length ? (
                  data.themes.map((theme) => (
                    <div
                      key={theme.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-subtle)] px-3 py-2 text-sm"
                    >
                      <span className="text-[var(--text-secondary)]">
                        {theme.label}
                      </span>
                      <Badge variant="accent">{theme.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">
                    No deterministic themes yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
              <h4 className="font-semibold text-[var(--foreground)]">
                Investigation prompts
              </h4>
              {data.investigationPrompts.length ? (
                <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                  {data.investigationPrompts.map((prompt) => (
                    <li key={prompt}>→ {prompt}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  No investigation prompts are available.
                </p>
              )}
            </section>
          </div>

          <section aria-labelledby="recent-signals-heading">
            <h4
              id="recent-signals-heading"
              className="font-semibold text-[var(--foreground)]"
            >
              Recent signals
            </h4>
            {data.recentSignals.length ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {data.recentSignals.map((signal) => (
                  <article
                    key={signal.id}
                    className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge>{signal.type.replaceAll("_", " ")}</Badge>
                      <Badge
                        variant={
                          signal.priority === "urgent"
                            ? "danger"
                            : signal.priority === "high"
                              ? "warning"
                              : "default"
                        }
                      >
                        {signal.priority}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">
                      {signal.snippet}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {signal.pagePath ?? "Unknown path"} ·{" "}
                      {formatDate(signal.createdAt)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No recent customer signals.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
            <h4 className="font-semibold text-[var(--foreground)]">
              Friction surfaces
            </h4>
            <div className="mt-3 grid gap-5 text-sm md:grid-cols-3">
              {(
                [
                  ["Paths", data.frictionSurfaces.paths],
                  ["Devices", data.frictionSurfaces.devices],
                  ["App versions", data.frictionSurfaces.appVersions],
                ] as const
              ).map(([label, values]) => (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {label}
                  </p>
                  {values.length ? (
                    values.map((item) => (
                      <p
                        key={item.value}
                        className="mt-1 flex justify-between gap-3 text-[var(--text-secondary)]"
                      >
                        <span className="truncate">{item.value}</span>
                        <span className="tabular-nums text-[var(--foreground)]">
                          {item.count}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="mt-1 text-[var(--text-muted)]">Unavailable</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
