"use client";

import Link from "next/link";
import { useMemo } from "react";
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
 * Never fabricates historical chart points — a chart only renders when a real
 * persisted balance series exists (none in product yet).
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

  // No persisted account-balance history yet. Do not project or invent points.
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
      aria-label="Total Net Worth — open accounts"
    >
      <section className="ios-home-hero rounded-[22px] bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-hover)] p-5 text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)]">
        <p className="text-[13px] font-medium text-white/80">Total Net Worth</p>
        <p
          className={cn(
            "mt-1.5 min-w-0 break-words text-[clamp(1.75rem,8vw,2.5rem)] font-semibold leading-none tracking-tight tabular-nums",
            breakdown.netWorth.value < 0 ? "text-[var(--danger)]" : "text-white",
          )}
        >
          {formatCurrency(breakdown.netWorth.value)}
        </p>
        {change !== 0 ? (
          <p
            className={cn(
              "mt-2 text-[13px] font-semibold tabular-nums",
              changePositive ? "text-emerald-100" : "text-rose-100",
            )}
          >
            {formatMonthlyChange(change)}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-white/70">Assets minus liabilities</p>
        )}

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-2">
          <div className="ios-metric-chip min-w-0 rounded-[14px] bg-white/10 px-3 py-2.5">
            <span className="text-[11px] font-medium text-white/70">Assets</span>
            <strong className="mt-0.5 block truncate text-[15px] font-semibold tabular-nums text-white">
              {formatCurrency(breakdown.assets)}
            </strong>
          </div>
          <div className="ios-metric-chip min-w-0 rounded-[14px] bg-white/10 px-3 py-2.5">
            <span className="text-[11px] font-medium text-white/70">Liabilities</span>
            <strong className="mt-0.5 block truncate text-[15px] font-semibold tabular-nums text-white">
              {formatCurrency(breakdown.liabilities)}
            </strong>
          </div>
        </div>

        {/* Historical chart intentionally omitted until real balance history exists. */}
        {hasHistoricalBalanceSeries ? <span className="sr-only">History available</span> : null}
      </section>
    </Link>
  );
}
