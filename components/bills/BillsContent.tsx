"use client";

import { useMemo, useState } from "react";
import { AddBillModal } from "@/components/bills/AddBillModal";
import { BillCard } from "@/components/bills/BillCard";
import { DeleteBillModal } from "@/components/bills/DeleteBillModal";
import { EditBillModal } from "@/components/bills/EditBillModal";
import { PaycheckSplitPanel } from "@/components/paycheck/PaycheckSplitPanel";
import { Button, EmptyState, PageHeader, SkeletonGrid, StatCard } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  getMonthlyBills,
  getPaidBills,
  getUpcomingBills,
} from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import type { Bill } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

function BillSection({
  title,
  bills,
  onEdit,
  onDelete,
  onMarkPaid,
}: {
  title: string;
  bills: ReturnType<typeof getUpcomingBills>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkPaid: (id: string) => void;
}) {
  if (bills.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {bills.map((bill) => (
          <BillCard
            key={bill.id}
            bill={bill}
            onEdit={() => onEdit(bill.id)}
            onDelete={() => onDelete(bill.id)}
            onMarkPaid={() => onMarkPaid(bill.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function BillsContent() {
  const finance = useFinance();
  const { markBillPaid, isLoading } = finance;
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBillId, setEditBillId] = useState<string | null>(null);
  const [deleteBillId, setDeleteBillId] = useState<string | null>(null);

  const monthlyBills = useMemo(() => getMonthlyBills(finance), [finance]);
  const upcomingBills = useMemo(() => getUpcomingBills(finance), [finance]);
  const paidBills = useMemo(() => getPaidBills(finance), [finance]);
  const summary = finance.dashboard.billsSummary;

  if (isLoading) {
    return <SkeletonGrid count={3} />;
  }

  function findBill(id: string): Bill | null {
    return finance.bills.find((bill) => bill.id === id) ?? null;
  }

  async function handleMarkPaid(id: string) {
    const bill = findBill(id);

    if (!bill) {
      return;
    }

    try {
      await markBillPaid(id);

      showToast({
        title: `✓ ${bill.name} Marked Paid`,
        subtitle: "✓ Dashboard Updated",
      });
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  const editBill = editBillId ? findBill(editBillId) : null;
  const deleteBill = deleteBillId ? findBill(deleteBillId) : null;

  return (
    <div className={cn(pageContainerWideClassName)}>
      <PageHeader
        action={
          <Button onClick={() => setIsCreateOpen(true)}>Add bill</Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard
          label="Due this week"
          value={String(summary.dueThisWeekCount)}
          change={formatCurrency(summary.dueThisWeekAmount)}
          positive={summary.dueThisWeekCount === 0}
        />
        <StatCard
          label="Cash after bills"
          value={formatCurrency(summary.monthlyCashRemaining)}
          change={`${formatCurrency(summary.totalMonthlyBills)} monthly`}
          positive={summary.monthlyCashRemaining >= 0}
        />
      </div>

      <PaycheckSplitPanel />

      {finance.bills.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Add your first bill to track due dates and monthly spending."
          actionLabel="Add bill"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="space-y-[3.25rem] lg:space-y-[4.5rem]">
          <BillSection
            title="Monthly"
            bills={monthlyBills}
            onEdit={setEditBillId}
            onDelete={setDeleteBillId}
            onMarkPaid={handleMarkPaid}
          />
          <BillSection
            title="Upcoming"
            bills={upcomingBills}
            onEdit={setEditBillId}
            onDelete={setDeleteBillId}
            onMarkPaid={handleMarkPaid}
          />
          <BillSection
            title="Paid"
            bills={paidBills}
            onEdit={setEditBillId}
            onDelete={setDeleteBillId}
            onMarkPaid={handleMarkPaid}
          />
        </div>
      )}

      <AddBillModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <EditBillModal bill={editBill} onClose={() => setEditBillId(null)} />
      <DeleteBillModal bill={deleteBill} onClose={() => setDeleteBillId(null)} />
    </div>
  );
}
