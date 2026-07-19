"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  PanelLink,
} from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

type DebtOverviewCardProps = {
  embedded?: boolean;
};

function DebtProgressRing({ progress }: { progress: number }) {
  const size = 96;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--success)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums text-[var(--foreground)]">
        {Math.round(progress)}%
      </span>
    </div>
  );
}

export function DebtOverviewCard({ embedded = false }: DebtOverviewCardProps) {
  const { dashboard } = useFinance();
  const summary = dashboard.debtsSummary;

  const content = useMemo(() => {
    if (summary.activeDebtCount === 0) {
      return (
        <p className="py-2 text-sm text-[var(--text-muted)]">
          No active debt.{" "}
          <Link href="/debt" className="text-[var(--accent)] hover:underline">
            Debt planner
          </Link>
        </p>
      );
    }

    return (
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <DebtProgressRing progress={summary.debtFreeProgress} />
        <div className="grid flex-1 grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Total
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(summary.totalDebt)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Next
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
              {summary.nextPayment
                ? formatCurrency(summary.nextPayment.amount)
                : "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }, [summary]);

  if (embedded) {
    return (
      <div>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)] sm:text-base">
            Debt Progress
          </h2>
          <PanelLink href="/debt">View all</PanelLink>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Debt Progress"
        action={<PanelLink href="/debt">View all</PanelLink>}
      />
      <CardContent>{content}</CardContent>
    </Card>
  );
}
