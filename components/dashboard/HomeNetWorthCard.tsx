"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import {
  calculateAssets,
  calculateLiabilities,
  calculateNetWorth,
} from "@/lib/calculations/netWorth";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";

/**
 * Desktop/web Home centerpiece. Uses shared net-worth calculations only.
 * No fabricated historical trend — honest empty state until real balance
 * history exists.
 */
export function HomeNetWorthCard() {
  const finance = useFinance();
  const breakdown = useMemo(() => {
    const netWorth = calculateNetWorth(finance);
    return {
      netWorth,
      assets: calculateAssets(finance),
      liabilities: calculateLiabilities(finance),
    };
  }, [finance]);

  const hasHistoricalBalanceSeries = false;
  const change = breakdown.netWorth.monthlyChange;

  return (
    <Link
      href="/accounts"
      className="focus-ring block rounded-[var(--radius-card)]"
      data-home-hero="net-worth"
    >
      <Card className="border-[var(--surface-border)] bg-[var(--surface)] transition-colors hover:border-[var(--surface-border-strong)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-muted)]">
                Total Net Worth
              </p>
              <p
                className={cn(
                  "mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl",
                  breakdown.netWorth.value < 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--foreground)]",
                )}
              >
                {formatCurrency(breakdown.netWorth.value)}
              </p>
              <p
                className={cn(
                  "mt-2 text-sm font-semibold tabular-nums",
                  change >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
                )}
              >
                {formatMonthlyChange(change)}
                <span className="ml-1 font-medium text-[var(--text-muted)]">
                  this month
                </span>
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:w-72">
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5">
                <p className="text-xs text-[var(--text-muted)]">Assets</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(breakdown.assets)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5">
                <p className="text-xs text-[var(--text-muted)]">Liabilities</p>
                <p className="mt-1 truncate text-base font-semibold tabular-nums text-[var(--danger)]">
                  {formatCurrency(breakdown.liabilities)}
                </p>
              </div>
            </div>
          </div>
          {hasHistoricalBalanceSeries ? null : (
            <p className="mt-4 text-xs leading-snug text-[var(--text-subtle)]">
              Historical net worth chart appears after account balances are tracked
              over time — showing your current position only.
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
