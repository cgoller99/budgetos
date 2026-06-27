"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

export function BillsOverviewCard() {
  const { dashboard } = useFinance();
  const summary = dashboard.billsSummary;

  const metrics = [
    {
      label: "Due this week",
      value: String(summary.dueThisWeekCount),
      detail: formatCurrency(summary.dueThisWeekAmount),
    },
    {
      label: "Monthly bills",
      value: formatCurrency(summary.totalMonthlyBills),
      detail: "Total obligations",
    },
    {
      label: "Next bill",
      value: summary.nextBill?.name ?? "None",
      detail: summary.nextBill
        ? `${summary.nextBill.dueDate} · ${formatCurrency(summary.nextBill.amount)}`
        : "All caught up",
    },
    {
      label: "Cash after bills",
      value: formatCurrency(summary.monthlyCashRemaining),
      detail: "Income minus bills",
      positive: summary.monthlyCashRemaining >= 0,
    },
  ];

  return (
    <Card padding="lg">
      <CardHeader
        title="Bills"
        action={
          <Link
            href="/bills"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            Manage
          </Link>
        }
      />

      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-sm text-white/38">{metric.label}</p>
              <p className="mt-2 truncate text-xl font-semibold tabular-nums text-white">
                {metric.value}
              </p>
              <p
                className={`mt-1.5 truncate text-sm ${
                  metric.positive === false
                    ? "text-rose-400/90"
                    : metric.positive === true
                      ? "text-emerald-400/90"
                      : "text-white/38"
                }`}
              >
                {metric.detail}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
