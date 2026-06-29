"use client";

import { useState } from "react";
import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { AnimatedNumber, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import type { MoneyFlowStageData } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

function formatFlowAmount(amount: number, isOutflow: boolean): string {
  if (isOutflow) {
    return `-${formatCurrency(amount)}`;
  }

  return formatCurrency(amount);
}

function FlowStageNode({
  stage,
  isSelected,
  onSelect,
}: {
  stage: MoneyFlowStageData;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-2xl px-5 py-4 text-left transition-all duration-300 ease-out",
        isSelected
          ? "bg-[#0077ed]/8 ring-1 ring-[#0077ed]/20"
          : "hover:bg-[var(--surface-hover)]",
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{ backgroundColor: `${stage.color}14` }}
        >
          {stage.icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--text-muted)]">{stage.label}</p>
          <p
            className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)] sm:text-2xl"
            style={{ color: isSelected ? stage.color : undefined }}
          >
            <AnimatedNumber
              value={stage.amount}
              format={(value) =>
                formatFlowAmount(Math.round(value), stage.isOutflow)
              }
            />
          </p>
        </div>

        <p
          className="shrink-0 text-base font-medium tabular-nums text-[var(--text-muted)]"
          style={{ color: isSelected ? stage.color : undefined }}
        >
          <AnimatedNumber
            value={stage.percentOfIncome}
            format={(value) => `${Math.round(value)}%`}
          />
        </p>
      </div>
    </button>
  );
}

export function MoneyFlowCard() {
  const { dashboard } = useFinance();
  const { moneyFlow } = dashboard;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stages = moneyFlow.stages;

  return (
    <Card padding="lg" hover className="money-flow-enter">
      <CardHeader
        title="Money flow"
        action={
          <InfoTooltip label="Shows where monthly income goes after bills, goals, debt, and other outflows." />
        }
      />

      <CardContent>
        <div className="space-y-1">
          {stages.map((stage) => (
            <FlowStageNode
              key={stage.id}
              stage={stage}
              isSelected={selectedId === stage.id}
              onSelect={() =>
                setSelectedId((current) =>
                  current === stage.id ? null : stage.id,
                )
              }
            />
          ))}
        </div>

        <div className="mt-8 border-t border-[var(--surface-border)] pt-7">
          <p className="text-sm text-[var(--text-muted)]">Safe to spend</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#4da3ff] sm:text-3xl">
            <AnimatedNumber
              value={moneyFlow.safeToSpend}
              format={(value) => formatCurrency(Math.round(value))}
            />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
