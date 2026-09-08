"use client";

import { Badge, Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import type { AiTeamProductAnalytics } from "@/lib/ai-team/types";
import { formatDate } from "./shared";

type Props = {
  data: AiTeamProductAnalytics | null;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
};

export function ProductAnalyticsCenter({
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
            Product Analytics
          </h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Observed, derived, and missing product signals remain explicitly
            separated.
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
          icon="⌁"
          title="Analytics unavailable"
          description="Refresh to load evidence-backed product intelligence."
        />
      ) : (
        <>
          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-[var(--foreground)]">
                PostHog connection
              </h4>
              <Badge
                variant={
                  data.posthog.status === "connected"
                    ? "success"
                    : data.posthog.status === "error"
                      ? "danger"
                      : "warning"
                }
              >
                {data.posthog.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {data.posthog.detail}
            </p>
          </section>

          <section aria-labelledby="product-signals-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h4
                id="product-signals-heading"
                className="font-semibold text-[var(--foreground)]"
              >
                Signals
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                Generated {formatDate(data.generatedAt)}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.signals.map((signal) => (
                <article
                  key={signal.id}
                  className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4"
                >
                  <Badge
                    variant={
                      signal.state === "observed"
                        ? "success"
                        : signal.state === "derived"
                          ? "accent"
                          : "warning"
                    }
                  >
                    {signal.state}
                  </Badge>
                  <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                    {signal.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                    {signal.state === "missing"
                      ? "Unavailable"
                      : signal.rate !== undefined
                        ? `${signal.rate}%`
                        : (signal.value ?? "Unavailable")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {signal.detail}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                    Source: {signal.source}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="funnels-heading">
            <h4
              id="funnels-heading"
              className="font-semibold text-[var(--foreground)]"
            >
              Evidence-backed funnels
            </h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {data.funnels.map((funnel) => (
                <article
                  key={funnel.id}
                  className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5"
                >
                  <h5 className="font-semibold text-[var(--foreground)]">
                    {funnel.label}
                  </h5>
                  <div className="mt-3 space-y-3">
                    {funnel.stages.map((stage) => (
                      <div key={stage.label}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="text-[var(--text-secondary)]">
                            {stage.label}
                          </span>
                          <span className="tabular-nums text-[var(--foreground)]">
                            {stage.count ?? "Missing"}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {stage.source}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 border-t border-[var(--surface-border)] pt-3 text-xs text-[var(--text-muted)]">
                    Conversion:{" "}
                    {funnel.conversionRate === null
                      ? "Unavailable — no valid denominator"
                      : `${funnel.conversionRate}%`}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h4 className="font-semibold text-amber-100">
              Missing evidence
            </h4>
            {data.missingEvidence.length ? (
              <ul className="mt-2 space-y-1 text-sm text-amber-100/70">
                {data.missingEvidence.map((item) => (
                  <li key={item}>— {item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-amber-100/70">
                No missing evidence was reported for the current signal set.
              </p>
            )}
            <p className="mt-3 text-xs text-amber-100/60">
              Rates are shown only when the source provides a valid denominator.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
