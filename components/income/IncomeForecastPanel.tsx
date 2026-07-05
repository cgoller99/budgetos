"use client";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

const HORIZON_LABELS: Record<string, string> = {
  "30d": "30 Days",
  "90d": "90 Days",
  "6mo": "6 Months",
  "1yr": "1 Year",
};

export function IncomeForecastPanel() {
  const { snapshot, incomePlan } = useFinance();
  const forecasts = snapshot.forecasts;

  if (!incomePlan) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--text-muted)]">
          Set up your paycheck plan to see balance forecasts.
        </CardContent>
      </Card>
    );
  }

  if (forecasts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-[var(--text-muted)]">
          Add allocations to generate forecasts.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {forecasts.map((forecast) => (
        <Card key={forecast.horizon}>
          <CardHeader
            title={HORIZON_LABELS[forecast.horizon] ?? forecast.horizon}
            description={`${forecast.paycheckCount} paychecks · ${forecast.horizonDays} days`}
          />
          <CardContent className="space-y-3">
            {forecast.envelopes.slice(0, 6).map((envelope) => (
              <div
                key={envelope.envelopeId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-[var(--text-secondary)]">
                  {envelope.name}
                </span>
                <span className="shrink-0 tabular-nums text-white">
                  {formatCurrency(envelope.projectedBalance)}
                </span>
              </div>
            ))}
            {forecast.envelopes.length > 6 ? (
              <p className="text-xs text-[var(--text-muted)]">
                +{forecast.envelopes.length - 6} more envelopes
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
