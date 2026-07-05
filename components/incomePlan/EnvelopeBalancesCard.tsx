"use client";

import { useMemo } from "react";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { buildVirtualEnvelopes } from "@/lib/allocation/envelopes";
import { formatCurrency } from "@/lib/finance/format";

export function EnvelopeBalancesCard() {
  const finance = useFinance();
  const plan = finance.incomePlan;

  const envelopes = useMemo(
    () => buildVirtualEnvelopes(finance, plan),
    [finance, plan],
  );

  if (!plan || envelopes.length === 0) {
    return null;
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Envelope balances"
        description="Virtual balances from your Income Plan allocations."
      />
      <CardContent className="space-y-3">
        {envelopes.map((envelope) => (
          <div
            key={envelope.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-xl" aria-hidden>
                {envelope.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--foreground)]">
                  {envelope.name}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  {envelope.target
                    ? `${formatCurrency(envelope.balance)} of ${formatCurrency(envelope.target)}`
                    : `${formatCurrency(envelope.contributionAmount ?? 0)} per paycheck`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(envelope.balance)}
              </span>
              {envelope.nextContributionDate && (
                <Badge variant="accent" className="text-xs">
                  Next: {envelope.nextContributionDate}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
