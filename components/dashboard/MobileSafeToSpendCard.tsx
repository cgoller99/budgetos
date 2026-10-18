"use client";

import Link from "next/link";
import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { useFinance } from "@/context/FinanceContext";
import { forecastCashUntilPayday } from "@/lib/finance/cashFlowForecast";
import { describeCashOutlook, forecastCashOutlook } from "@/lib/finance/cashOutlook";
import { formatCurrency } from "@/lib/finance/format";

export function MobileSafeToSpendCard() {
  const finance = useFinance();
  const safeToSpend = finance.dashboard.moneyFlow.safeToSpend;
  const paydayForecast = forecastCashUntilPayday(finance);
  const cashOutlook = describeCashOutlook(forecastCashOutlook(finance));

  return (
    <Link
      href="/budgets"
      className="focus-ring block rounded-3xl"
      aria-label="Safe to Spend breakdown"
    >
      <section className="rounded-3xl border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--accent)]/15 to-transparent p-6 transition-colors hover:border-[var(--accent)]/35">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-white/55">
            Safe to spend
          </p>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-white">
            {formatCurrency(safeToSpend)}
          </p>
          <p className="mt-2 text-sm text-white/45">
            After bills, goals, and planned savings this month
          </p>
          {paydayForecast.nextPayDate ? (
            <p className="mt-1 text-sm text-white/55">
              {formatCurrency(paydayForecast.safeUntilPayday)} until payday after bills due
            </p>
          ) : null}
          {cashOutlook ? (
            <p className="mt-1 text-sm text-white/55">{cashOutlook}</p>
          ) : null}
        </div>
        <InfoTooltip label="Monthly amount left after planned bills, debt payments, goals, and investments." />
      </div>
      </section>
    </Link>
  );
}
