"use client";

import Link from "next/link";
import { useMemo } from "react";
import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { Badge, Card, CardContent, CardHeader, EmptyState } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { getBillStatusVariant } from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import { getPaycheckSplitSummary } from "@/lib/finance/paycheckSplit";

type PaycheckSplitPanelProps = {
  compact?: boolean;
};

export function PaycheckSplitPanel({ compact = false }: PaycheckSplitPanelProps) {
  const finance = useFinance();
  const summary = useMemo(() => getPaycheckSplitSummary(finance), [finance]);

  const activePeriods = summary.periods.filter(
    (period) => period.bills.length > 0 || period.income > 0,
  );

  if (activePeriods.length === 0) {
    return (
      <EmptyState
        title="No paycheck split yet"
        description="Assign bills to paycheck periods and add income to see your split."
        actionLabel="Add income"
        onAction={() => {
          window.location.href = "/income";
        }}
      />
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {!compact && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-[var(--text-muted)]">
                Paycheck bill split
              </p>
              <InfoTooltip label="Groups bills by pay period so you can see what each paycheck needs to cover." />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
              Income vs bills by pay period
            </h3>
          </div>
          <Link
            href="/bills"
            className="text-sm text-[var(--accent)] transition-colors hover:underline"
          >
            Assign bills
          </Link>
        </div>
      )}

      <div
        className={
          compact
            ? "space-y-3"
            : "grid grid-cols-1 gap-4 xl:grid-cols-2"
        }
      >
        {summary.periods.map((period) => {
          const hasActivity = period.bills.length > 0 || period.income > 0;

          if (!hasActivity) {
            return null;
          }

          return (
            <Card key={period.id} padding="lg">
              <CardHeader
                title={period.label}
                action={
                  period.isUpcoming ? (
                    <Badge variant="accent">Upcoming period</Badge>
                  ) : undefined
                }
              />
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      Income
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                      {formatCurrency(period.income)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      Bills
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                      {formatCurrency(period.billsTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      Remaining
                    </p>
                    <p
                      className={`mt-1 text-lg font-semibold ${
                        period.remaining >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {formatCurrency(period.remaining)}
                    </p>
                  </div>
                </div>

                {period.bills.length > 0 ? (
                  <ul className="space-y-2">
                    {period.bills.map((bill) => (
                      <li
                        key={bill.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {bill.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {bill.formattedDueDate}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {formatCurrency(bill.amount)}
                          </p>
                          <Badge variant={getBillStatusVariant(bill.status)}>
                            {bill.statusLabel}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">
                    No bills assigned to this paycheck yet.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
