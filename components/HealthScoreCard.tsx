"use client";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { healthScoreToneClasses } from "@/lib/finance/format";

export function HealthScoreCard() {
  const { dashboard } = useFinance();
  const { financialHealthScore } = dashboard;

  return (
    <Card padding="lg">
      <CardHeader title="Financial health" />

      <CardContent className="flex items-center gap-8">
        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
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
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#0077ed"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={financialHealthScore.strokeDasharray}
              strokeDashoffset={financialHealthScore.strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <span className="absolute text-3xl font-semibold tabular-nums">
            {financialHealthScore.score}
          </span>
        </div>

        <div className="space-y-4 text-base">
          {financialHealthScore.metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-8"
            >
              <span className="text-white/38">{metric.label}</span>
              <span
                className={`font-medium ${healthScoreToneClasses[metric.tone]}`}
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
