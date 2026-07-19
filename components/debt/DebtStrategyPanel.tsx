"use client";

import { Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatCurrency } from "@/lib/finance/format";
import { getDebtStrategyInsight } from "@/lib/finance/debts";
import type { DebtStrategy, FinanceData } from "@/lib/finance/types";

type DebtStrategyPanelProps = {
  data: FinanceData;
  strategy: DebtStrategy;
  onStrategyChange: (strategy: DebtStrategy) => void;
};

export function DebtStrategyPanel({
  data,
  strategy,
  onStrategyChange,
}: DebtStrategyPanelProps) {
  const insight = getDebtStrategyInsight(data, strategy);

  return (
    <Card padding="lg" className="bill-card-enter">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Debt strategy
          </h2>
          <p className="mt-2 text-sm text-white/40">
            Compare payoff plans and see how extra payments accelerate your debt
            free date.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <StrategyToggle
            label="Snowball Method"
            description="Lowest balance first"
            selected={strategy === "snowball"}
            onClick={() => onStrategyChange("snowball")}
          />
          <StrategyToggle
            label="Avalanche Method"
            description="Highest interest first"
            selected={strategy === "avalanche"}
            onClick={() => onStrategyChange("avalanche")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InsightStat
            label="Recommended next debt"
            value={insight.recommendedDebt?.name ?? "No active debt"}
            detail={
              insight.recommendedDebt
                ? `${formatCurrency(insight.recommendedDebt.balance)} · ${insight.recommendedDebt.interestRate}% APR`
                : "Add debts to unlock recommendations"
            }
          />
          <InsightStat
            label="Time saved with extra"
            value={
              insight.monthsSaved > 0
                ? `${insight.monthsSaved} months`
                : "—"
            }
            detail={`Paying ${formatCurrency(insight.extraPayment)} extra per month`}
          />
          <InsightStat
            label="Interest saved"
            value={formatCurrency(insight.interestSaved)}
            detail="Compared to minimum payments only"
          />
          <InsightStat
            label="New estimated payoff"
            value={insight.estimatedPayoffDate}
            detail={`Baseline ${insight.baselinePayoffDate}`}
          />
        </div>
      </div>
    </Card>
  );
}

function StrategyToggle({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[220px] flex-1 items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-colors duration-200",
        selected
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-white/20",
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </span>
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="mt-1 block text-xs text-white/40">{description}</span>
      </span>
    </button>
  );
}

function InsightStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/40">{detail}</p>
    </div>
  );
}
