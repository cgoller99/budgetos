"use client";

import { useMemo } from "react";
import { AnimatedNumber, ExpandableCard, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { WEEKS_PER_MONTH } from "@/lib/finance/safeToSpend";

function toWeekly(amount: number): number {
  return Math.round(amount / WEEKS_PER_MONTH);
}

function CashFlowGauge({
  weekly,
  compact = false,
}: {
  weekly: { income: number; spending: number; remaining: number };
  compact?: boolean;
}) {
  const total = Math.max(weekly.income + weekly.spending, 1);
  const incomeSweep = (weekly.income / total) * 180;
  const spendingSweep = (weekly.spending / total) * 180;
  const height = compact ? "h-14 w-24" : "h-28 w-44";

  return (
    <div className={`relative shrink-0 ${height}`}>
      <svg viewBox="0 0 176 112" className="h-full w-full" aria-hidden>
        <path
          d="M 18 96 A 70 70 0 0 1 158 96"
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth={compact ? 10 : 12}
          strokeLinecap="round"
        />
        {weekly.income > 0 ? (
          <path
            d="M 18 96 A 70 70 0 0 1 158 96"
            fill="none"
            stroke="var(--success)"
            strokeWidth={compact ? 10 : 12}
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
            strokeWidth={compact ? 10 : 12}
            strokeLinecap="round"
            pathLength={180}
            strokeDasharray={`${spendingSweep} 180`}
            strokeDashoffset={-incomeSweep}
          />
        ) : null}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        {!compact ? (
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Left
          </p>
        ) : null}
        <p
          className={
            compact
              ? "text-sm font-semibold tabular-nums text-[var(--accent-light)]"
              : "text-lg font-semibold tabular-nums text-[var(--accent-light)]"
          }
        >
          <AnimatedNumber
            value={weekly.remaining}
            format={(value) => formatCurrency(Math.round(value))}
          />
        </p>
      </div>
    </div>
  );
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

  return (
    <ExpandableCard
      title="Weekly Cash Flow"
      headerAction={<PanelLink href="/income">Income</PanelLink>}
      summary={
        <div className="flex items-center gap-3">
          <CashFlowGauge weekly={weekly} compact />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                In
              </p>
              <p className="text-sm font-semibold tabular-nums text-[var(--success)]">
                {formatCurrency(weekly.income)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Out
              </p>
              <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(weekly.spending)}
              </p>
            </div>
          </div>
        </div>
      }
      insights={
        <p className="text-xs text-[var(--text-muted)]">
          Net weekly position after planned bills and debt payments.
        </p>
      }
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <CashFlowGauge weekly={weekly} />
        <div className="grid w-full flex-1 grid-cols-3 gap-4">
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
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Left
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--accent-light)]">
              {formatCurrency(weekly.remaining)}
            </p>
          </div>
        </div>
      </div>
    </ExpandableCard>
  );
}
