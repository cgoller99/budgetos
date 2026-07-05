"use client";

import { useMemo, useState } from "react";
import { AddIncomeModal } from "@/components/income/AddIncomeModal";
import { DeleteIncomeModal } from "@/components/income/DeleteIncomeModal";
import { EditIncomeModal } from "@/components/income/EditIncomeModal";
import { IncomeRow } from "@/components/income/IncomeRow";
import {
  Button,
  EmptyState,
  PageHeader,
  SkeletonGrid,
  StatCard,
} from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  getIncomeDashboardSummary,
  getIncomeTableRows,
} from "@/lib/finance/income";
import type { IncomeSource } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

export function IncomeContent({ embedded = false }: { embedded?: boolean }) {
  const finance = useFinance();
  const {
    isLoading,
    markIncomeReceived,
    pauseIncome,
    resumeIncome,
  } = finance;
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editIncomeId, setEditIncomeId] = useState<string | null>(null);
  const [deleteIncomeId, setDeleteIncomeId] = useState<string | null>(null);

  const summary = useMemo(
    () => getIncomeDashboardSummary(finance),
    [finance],
  );
  const rows = useMemo(() => getIncomeTableRows(finance), [finance]);

  if (isLoading) {
    return <SkeletonGrid count={4} />;
  }

  function findIncome(id: string): IncomeSource | null {
    return finance.income.find((source) => source.id === id) ?? null;
  }

  async function handleMarkReceived(id: string) {
    const income = findIncome(id);

    if (!income) {
      return;
    }

    try {
      await markIncomeReceived(id);

      showToast({
        title: `✓ ${income.name} Received`,
        subtitle: "✓ Dashboard Updated",
      });
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  async function handlePause(id: string) {
    const income = findIncome(id);

    if (!income) {
      return;
    }

    try {
      await pauseIncome(id);

      showToast({
        title: `${income.name} Paused`,
        subtitle: "Income excluded from active projections",
      });
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  async function handleResume(id: string) {
    const income = findIncome(id);

    if (!income) {
      return;
    }

    try {
      await resumeIncome(id);

      showToast({
        title: `${income.name} Resumed`,
        subtitle: "✓ Dashboard Updated",
      });
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  const editIncome = editIncomeId ? findIncome(editIncomeId) : null;
  const deleteIncome = deleteIncomeId ? findIncome(deleteIncomeId) : null;
  const nextPaycheckChange = summary.nextPaycheck
    ? summary.nextPaycheck.daysUntil === 0
      ? "Due today"
      : summary.nextPaycheck.daysUntil < 0
        ? "Overdue"
        : `${summary.nextPaycheck.daysUntil} days`
    : "No active income";

  return (
    <div className={cn(!embedded && pageContainerWideClassName)}>
      {!embedded ? (
        <PageHeader
          action={
            <Button onClick={() => setIsCreateOpen(true)}>Add income source</Button>
          }
        />
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateOpen(true)}>Add income source</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly income"
          value={formatCurrency(summary.monthlyIncome)}
          change="Recurring sources"
          positive
        />
        <StatCard
          label="Annual income"
          value={formatCurrency(summary.annualIncome)}
          change="Projected from recurring"
          positive
        />
        <StatCard
          label="Next paycheck"
          value={
            summary.nextPaycheck
              ? formatCurrency(summary.nextPaycheck.amount)
              : "—"
          }
          change={
            summary.nextPaycheck
              ? `${summary.nextPaycheck.name} · ${summary.nextPaycheck.formattedDate}`
              : nextPaycheckChange
          }
          positive={Boolean(summary.nextPaycheck)}
        />
        <StatCard
          label="Income sources"
          value={String(summary.sourceCount)}
          change={`${summary.activeSourceCount} active`}
          positive={summary.activeSourceCount > 0}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="💵"
          title="No income sources yet"
          description="Add your paychecks and other recurring income to power Money Flow, Safe To Spend, and your roadmap."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              Add income source
            </Button>
          }
        />
      ) : (
        <section className="space-y-4">
          <div className="hidden rounded-3xl border border-white/[0.04] bg-white/[0.015] px-6 py-4 lg:block">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_auto] gap-4 text-xs font-medium uppercase tracking-[0.14em] text-white/35">
              <span>Source name</span>
              <span>Amount</span>
              <span>Frequency</span>
              <span>Next pay date</span>
              <span>Last paid</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <IncomeRow
                key={row.id}
                row={row}
                onEdit={() => setEditIncomeId(row.id)}
                onDelete={() => setDeleteIncomeId(row.id)}
                onPause={() => void handlePause(row.id)}
                onResume={() => void handleResume(row.id)}
                onMarkReceived={() => void handleMarkReceived(row.id)}
              />
            ))}
          </div>
        </section>
      )}

      <AddIncomeModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <EditIncomeModal
        income={editIncome}
        onClose={() => setEditIncomeId(null)}
      />
      <DeleteIncomeModal
        income={deleteIncome}
        onClose={() => setDeleteIncomeId(null)}
      />
    </div>
  );
}
