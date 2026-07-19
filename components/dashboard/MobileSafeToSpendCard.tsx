"use client";

import Link from "next/link";
import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { buildTransactionsHref, getCurrentMonthDateRange } from "@/lib/transactions/filterParams";

export function MobileSafeToSpendCard() {
  const { dashboard } = useFinance();
  const safeToSpend = dashboard.moneyFlow.safeToSpend;
  const { dateFrom, dateTo } = getCurrentMonthDateRange();

  return (
    <Link
      href={buildTransactionsHref({
        type: "expense",
        dateFrom,
        dateTo,
        filterLabel: "Recent spending",
      })}
      className="focus-ring block rounded-3xl"
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
        </div>
        <InfoTooltip label="Monthly amount left after planned bills, debt payments, goals, and investments." />
      </div>
      </section>
    </Link>
  );
}
