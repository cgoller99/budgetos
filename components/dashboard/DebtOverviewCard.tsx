"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  PanelLink,
  ProgressBar,
} from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

type DebtOverviewCardProps = {
  embedded?: boolean;
};

export function DebtOverviewCard({ embedded = false }: DebtOverviewCardProps) {
  const { dashboard } = useFinance();
  const summary = dashboard.debtsSummary;

  const content = useMemo(() => {
    if (summary.activeDebtCount === 0) {
      return (
        <p className="py-2 text-sm text-[var(--text-muted)]">
          No active debt.{" "}
          <Link href="/debt" className="text-[#0077ed] hover:underline">
            Debt planner
          </Link>
        </p>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Total
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(summary.totalDebt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Next
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">
              {summary.nextPayment
                ? formatCurrency(summary.nextPayment.amount)
                : "—"}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Progress
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-400/90">
              {Math.round(summary.debtFreeProgress)}%
            </p>
          </div>
        </div>
        <ProgressBar value={summary.debtFreeProgress} />
      </div>
    );
  }, [summary]);

  if (embedded) {
    return (
      <div>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
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
