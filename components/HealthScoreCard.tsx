"use client";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { healthScoreToneClasses } from "@/lib/finance/format";

export function HealthScoreCard() {
  const { dashboard } = useFinance();
  const { financialHealthScore } = dashboard;

  return (
    <Card variant="subtle" hover>
      <CardHeader title="Financial health" />

      <CardContent className="flex items-center gap-6">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg
            className="h-full w-full -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--surface-border)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={financialHealthScore.strokeDasharray}
              strokeDashoffset={financialHealthScore.strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <span className="absolute text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {financialHealthScore.score}
          </span>
        </div>

        <div className="space-y-2.5 text-sm">
          {financialHealthScore.metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-6"
            >
              <span className="text-[var(--text-muted)]">{metric.label}</span>
              <span
                className={`font-medium tabular-nums ${healthScoreToneClasses[metric.tone]}`}
              >
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
