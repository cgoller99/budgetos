import type { GoalTimelineMonth } from "@/lib/finance/goalAnalytics";
import { formatCurrency } from "@/lib/finance/format";

type GoalTimelineChartProps = {
  timeline: GoalTimelineMonth[];
};

export function GoalTimelineChart({ timeline }: GoalTimelineChartProps) {
  const hasContributions = timeline.some((item) => item.amount > 0);

  if (!hasContributions) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-6 text-center">
        <p className="text-sm font-medium text-[var(--foreground)]">
          No contribution history yet
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Confirmed contributions will appear here after you add money or apply a paycheck.
          Planned Income Plan amounts do not show until confirmed.
        </p>
      </div>
    );
  }

  const maxAmount = Math.max(...timeline.map((item) => item.amount), 1);
  const width = 280;
  const height = 72;
  const padding = 8;
  const step =
    timeline.length > 1
      ? (width - padding * 2) / (timeline.length - 1)
      : 0;

  const points = timeline
    .map((item, index) => {
      const x = padding + index * step;
      const y =
        height -
        padding -
        (item.amount / maxAmount) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-20 w-full text-[var(--accent)]"
        aria-hidden
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {timeline.map((item, index) => {
          const x = padding + index * step;
          const y =
            height -
            padding -
            (item.amount / maxAmount) * (height - padding * 2);

          return (
            <circle
              key={item.monthKey}
              cx={x}
              cy={y}
              r="3.5"
              fill="currentColor"
            />
          );
        })}
      </svg>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {timeline.map((item) => (
          <div
            key={item.monthKey}
            className="min-w-0 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-2 py-2 text-center"
          >
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {item.label}
            </p>
            <p className="mt-1 break-words text-xs font-semibold tabular-nums text-[var(--foreground)]">
              {item.amount > 0 ? `+${formatCurrency(item.amount)}` : "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
