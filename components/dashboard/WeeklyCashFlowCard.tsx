"use client";

import { useMemo } from "react";
import { AnimatedNumber, Card, CardContent, CardHeader, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { WEEKS_PER_MONTH } from "@/lib/finance/safeToSpend";

function toWeekly(amount: number): number {
  return Math.round(amount / WEEKS_PER_MONTH);
}

export function WeeklyCashFlowCard() {
  const { dashboard, snapshot } = useFinance();
  const { moneyFlow } = dashboard;

  const weekly = useMemo(
    () => ({
      income: toWeekly(moneyFlow.income),
      spending: toWeekly(moneyFlow.bills + moneyFlow.debts),
      remaining: snapshot.safeToSpendWeekly,
    }),
    [moneyFlow, snapshot.safeToSpendWeekly],
  );

  const total = Math.max(weekly.income + weekly.spending, 1);
  const incomeSweep = (weekly.income / total) * 180;
  const spendingSweep = (weekly.spending / total) * 180;

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Weekly Cash Flow"
        action={<PanelLink href="/income">Income</PanelLink>}
      />
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-28 w-44 shrink-0">
            <svg viewBox="0 0 176 112" className="h-full w-full" aria-hidden>
              <path
                d="M 18 96 A 70 70 0 0 1 158 96"
                fill="none"
                stroke="var(--surface-border)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {weekly.income > 0 ? (
                <path
                  d="M 18 96 A 70 70 0 0 1 158 96"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  pathLength={180}
                  strokeDasharray={`${incomeSweep} 180`}
                />
              ) : null}
              {weekly.spending > 0 ? (
                <path
                  d="M 18 96 A 70 70 0 0 1 158 96"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  pathLength={180}
                  strokeDasharray={`${spendingSweep} 180`}
                  strokeDashoffset={-incomeSweep}
                />
              ) : null}
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Left
              </p>
              <p className="text-lg font-semibold tabular-nums text-[var(--accent-light)]">
                <AnimatedNumber
                  value={weekly.remaining}
                  format={(value) => formatCurrency(Math.round(value))}
                />
              </p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                In
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--success)]">
                {formatCurrency(weekly.income)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Out
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(weekly.spending)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
