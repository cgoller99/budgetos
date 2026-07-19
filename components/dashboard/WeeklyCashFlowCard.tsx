"use client";

import { useMemo } from "react";
import { AnimatedNumber, Card, CardContent, CardHeader, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { WEEKS_PER_MONTH } from "@/lib/finance/safeToSpend";
import { cn } from "@/components/ui/cn";

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

  const maxFlow = Math.max(weekly.income, weekly.spending, 1);

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Weekly Cash Flow"
        action={<PanelLink href="/income">Income</PanelLink>}
      />
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              In
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-400/90">
              {formatCurrency(weekly.income)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Out
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(weekly.spending)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Left
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#4da3ff]">
              <AnimatedNumber
                value={weekly.remaining}
                format={(value) => formatCurrency(Math.round(value))}
              />
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-8 text-[10px] text-[var(--text-muted)]">In</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-border)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-400"
                style={{ width: `${(weekly.income / maxFlow) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 text-[10px] text-[var(--text-muted)]">Out</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-border)]">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-[#0077ed]/70 to-[#4da3ff]",
                )}
                style={{ width: `${(weekly.spending / maxFlow) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
