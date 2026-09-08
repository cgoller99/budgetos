"use client";

import { Badge, Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import type { AiTeamRevenueIntelligence } from "@/lib/ai-team/types";
import { MiniStat, formatDate } from "./shared";

type Props = {
  data: AiTeamRevenueIntelligence | null;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function RevenueCenter({
  data,
  onRefresh,
  loading,
  error,
}: Props) {
  const stripeValue = (value: number, format: "money" | "number" = "number") =>
    !data?.available
      ? "Unavailable"
      : format === "money"
        ? money(value)
        : value;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Revenue Command Center
            </h3>
            <Badge variant={data?.available ? "success" : "warning"}>
              Stripe {data?.available ? "connected" : "unavailable"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Read-only subscription intelligence and directional projections. No
            Stripe writes.
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
          icon="$"
          title="Revenue unavailable"
          description="Refresh to load read-only revenue intelligence."
        />
      ) : (
        <>
          {!data.available ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
              Stripe observations are unavailable. Zero-value Stripe metrics are
              withheld rather than presented as observed results.
            </p>
          ) : null}

          <section aria-labelledby="revenue-metrics-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h4
                id="revenue-metrics-heading"
                className="font-semibold text-[var(--foreground)]"
              >
                Current revenue signals
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                Generated {formatDate(data.generatedAt)}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                label="MRR"
                value={stripeValue(data.mrr, "money")}
                detail={data.available ? "Stripe observed" : "Not observed"}
              />
              <MiniStat
                label="ARR"
                value={stripeValue(data.arr, "money")}
                detail={data.available ? "MRR × 12" : "Not derivable"}
              />
              <MiniStat
                label="Paid users"
                value={data.paidUsers}
                detail={`${data.proUsers} Pro · ${data.proPlusUsers} Pro+`}
              />
              <MiniStat
                label="Blended ARPU"
                value={data.arpu === null ? "Unavailable" : money(data.arpu)}
                detail={
                  data.arpu === null
                    ? "No valid observed denominator"
                    : "MRR ÷ paid users"
                }
              />
              <MiniStat
                label="Pro"
                value={data.proUsers}
                detail="Active profile entitlements"
              />
              <MiniStat
                label="Pro+"
                value={data.proPlusUsers}
                detail="Active profile entitlements"
              />
              <MiniStat
                label="Churn"
                value={
                  data.available ? `${data.churnRate}%` : "Unavailable"
                }
                detail="Last 30 days"
              />
              <MiniStat
                label="New subscriptions"
                value={stripeValue(data.newSubscriptions)}
                detail="Last 30 days"
              />
              <MiniStat
                label="Cancellations"
                value={stripeValue(data.cancellations)}
                detail="Last 30 days"
              />
              <MiniStat
                label="Failed payments"
                value={stripeValue(data.failedPayments)}
                detail="Open Stripe invoices"
              />
              <MiniStat
                label="Free → paid ratio"
                value={
                  data.freeToPaidRatio === null
                    ? "Unavailable"
                    : `${(data.freeToPaidRatio * 100).toFixed(1)}%`
                }
                detail="Paid users ÷ free users"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
            <h4 className="font-semibold text-[var(--foreground)]">
              Directional MRR targets
            </h4>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Additional paying customers needed from current MRR to reach each
              target, using blended ARPU when available and configured monthly
              list prices. These are directional scenarios, not forecasts.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {data.projections.map((projection) => (
                <article
                  key={projection.targetMrr}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
                >
                  <p className="font-semibold text-[var(--foreground)]">
                    {money(projection.targetMrr)} MRR
                  </p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Additional blended customers:{" "}
                    {projection.blendedCustomersNeeded ?? "Unavailable"}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Pro at {money(data.proMonthlyPrice)}:{" "}
                    {projection.proCustomersNeeded}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Pro+ at {money(data.proPlusMonthlyPrice)}:{" "}
                    {projection.proPlusCustomersNeeded}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {data.notes.length ? (
            <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
              <h4 className="font-semibold text-[var(--foreground)]">
                Availability notes
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
                {data.notes.map((note) => (
                  <li key={note}>— {note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
