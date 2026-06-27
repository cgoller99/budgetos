"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
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
        <p className="text-base text-white/38">
          No active debt tracked.{" "}
          <Link href="/debt" className="text-white/60 hover:text-white">
            Debt planner
          </Link>
        </p>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
              Total debt
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-white">
              {formatCurrency(summary.totalDebt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
              Next payment
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-white">
              {summary.nextPayment
                ? formatCurrency(summary.nextPayment.amount)
                : "—"}
            </p>
            <p className="mt-1 text-sm text-white/38">
              {summary.nextPayment
                ? `${summary.nextPayment.name} · ${summary.nextPayment.dueDate}`
                : "No payment scheduled"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
              Debt free progress
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-400/90">
              {Math.round(summary.debtFreeProgress)}%
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-400/80"
                style={{ width: `${summary.debtFreeProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [summary]);

  if (embedded) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Debt overview
          </h2>
          <Link
            href="/debt"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            Debt planner
          </Link>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card hover>
      <CardHeader
        title="Debt overview"
        action={
          <Link
            href="/debt"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            Debt planner
          </Link>
        }
      />
      <CardContent>{content}</CardContent>
    </Card>
  );
}
