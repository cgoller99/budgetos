"use client";

import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

export function MobileSafeToSpendCard() {
  const { dashboard } = useFinance();
  const safeToSpend = dashboard.moneyFlow.safeToSpend;

  return (
    <section className="rounded-3xl border border-[#0077ed]/25 bg-gradient-to-br from-[#0077ed]/15 to-transparent p-6">
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
  );
}
