"use client";

import Link from "next/link";
import { useMemo } from "react";
import { IosCard } from "@/components/native/ios/IosPrimitives";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import {
  calculateAssets,
  calculateLiabilities,
  calculateNetWorth,
} from "@/lib/calculations/netWorth";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";
import { triggerHaptic } from "@/lib/native/haptics";

/**
 * Home centerpiece: authoritative net worth from shared calculations.
 * Does not fabricate historical balance charts — only shows a trend when
 * real account-balance history exists (none stored yet → honest empty state).
 */
export function IosNetWorthHero() {
  const finance = useFinance();

  const breakdown = useMemo(() => {
    const netWorth = calculateNetWorth(finance);
    return {
      netWorth,
      assets: calculateAssets(finance),
      liabilities: calculateLiabilities(finance),
    };
  }, [finance]);

  // No persisted account-balance history in the product yet. Never invent a
  // sparkline from transactions or monthlyChange projections.
  const hasHistoricalBalanceSeries = false;

  const change = breakdown.netWorth.monthlyChange;
  const changePositive = change >= 0;

  return (
    <Link
      href="/accounts"
      className="block active:opacity-95"
      onClick={() => {
        void triggerHaptic("selection");
      }}
      data-home-hero="net-worth"
    >
      <IosCard
        padding="md"
        className="border border-white/[0.06] bg-[var(--surface)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[var(--text-muted)]">
              Total Net Worth
            </p>
            <p
              className={cn(
                "mt-1.5 text-[36px] font-semibold leading-none tracking-tight tabular-nums",
                breakdown.netWorth.value < 0
                  ? "text-[var(--danger)]"
                  : "text-[var(--foreground)]",
              )}
            >
              {formatCurrency(breakdown.netWorth.value)}
            </p>
            <p
              className={cn(
                "mt-2 text-[13px] font-semibold tabular-nums",
                changePositive ? "text-[var(--success)]" : "text-[var(--danger)]",
              )}
            >
              {formatMonthlyChange(change)}
              <span className="ml-1 font-medium text-[var(--text-muted)]">
                this month
              </span>
            </p>
          </div>
          <span
            className="mt-1 shrink-0 text-[15px] text-[var(--accent-light)]"
            aria-hidden
          >
            ›
          </span>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-2">
          <div className="ios-metric-chip min-w-0 rounded-[14px] bg-white/[0.04] px-3 py-2.5">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Assets
            </span>
            <strong className="mt-0.5 block truncate text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(breakdown.assets)}
            </strong>
          </div>
          <div className="ios-metric-chip min-w-0 rounded-[14px] bg-white/[0.04] px-3 py-2.5">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Liabilities
            </span>
            <strong className="mt-0.5 block truncate text-[15px] font-semibold tabular-nums text-[var(--danger)]">
              {formatCurrency(breakdown.liabilities)}
            </strong>
          </div>
        </div>

        {hasHistoricalBalanceSeries ? null : (
          <p className="mt-3 text-[12px] leading-snug text-[var(--text-subtle)]">
            Historical net worth chart appears after account balances are tracked
            over time — current position only for now.
          </p>
        )}
      </IosCard>
    </Link>
  );
}
