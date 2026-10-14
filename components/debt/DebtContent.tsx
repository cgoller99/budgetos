"use client";

import { useMemo, useState } from "react";
import { AddDebtModal } from "@/components/debt/AddDebtModal";
import { DeleteDebtModal } from "@/components/debt/DeleteDebtModal";
import { EditDebtModal } from "@/components/debt/EditDebtModal";
import { DebtRow } from "@/components/debt/DebtRow";
import { DebtPayoffPlanner } from "@/components/debt/DebtPayoffPlanner";
import { MakePaymentModal } from "@/components/debt/MakePaymentModal";
import { IosDebtScreen } from "@/components/native/ios/IosDebtScreen";
import {
  Button,
  EmptyState,
  PageHeader,
  SkeletonGrid,
} from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { getDebtTableRows } from "@/lib/finance/debts";
import type { Debt } from "@/lib/finance/types";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

export function DebtContent() {
  const finance = useFinance();
  const { isLoading } = finance;
  const nativeIos = useNativeIos();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDebtId, setEditDebtId] = useState<string | null>(null);
  const [deleteDebtId, setDeleteDebtId] = useState<string | null>(null);
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null);

  const rows = useMemo(() => getDebtTableRows(finance), [finance]);

  if (nativeIos) {
    return <IosDebtScreen />;
  }

  if (isLoading) {
    return <SkeletonGrid count={4} />;
  }

  function findDebt(id: string): Debt | null {
    return finance.debts.find((debt) => debt.id === id) ?? null;
  }

  const editDebt = editDebtId ? findDebt(editDebtId) : null;
  const deleteDebt = deleteDebtId ? findDebt(deleteDebtId) : null;
  const paymentDebt = paymentDebtId ? findDebt(paymentDebtId) : null;

  return (
    <div className={cn(pageContainerWideClassName)}>
      <PageHeader
        action={
          <Button onClick={() => setIsCreateOpen(true)}>Add debt</Button>
        }
      />

      <DebtPayoffPlanner />

      {rows.length === 0 ? (
        <EmptyState
          icon="📉"
          title="No debts tracked yet"
          description="Add your loans and credit cards to build a payoff plan, compare snowball vs avalanche, and sync debt payments with Money Flow."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>Add debt</Button>
          }
        />
      ) : (
        <section className="space-y-4">
          <div className="hidden rounded-3xl border border-white/[0.04] bg-white/[0.015] px-6 py-4 xl:block">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto] gap-4 text-xs font-medium uppercase tracking-[0.14em] text-white/35">
              <span>Name</span>
              <span>Balance</span>
              <span>Interest</span>
              <span>Minimum</span>
              <span>Due date</span>
              <span>Account type</span>
              <span>Progress</span>
              <span className="text-right">Actions</span>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <DebtRow
                key={row.id}
                row={row}
                onEdit={() => setEditDebtId(row.id)}
                onDelete={() => setDeleteDebtId(row.id)}
                onMakePayment={() => setPaymentDebtId(row.id)}
              />
            ))}
          </div>
        </section>
      )}

      <AddDebtModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <EditDebtModal
        debt={editDebt}
        onClose={() => setEditDebtId(null)}
      />
      <DeleteDebtModal
        debt={deleteDebt}
        onClose={() => setDeleteDebtId(null)}
      />
      <MakePaymentModal
        debt={paymentDebt}
        onClose={() => setPaymentDebtId(null)}
      />
    </div>
  );
}
