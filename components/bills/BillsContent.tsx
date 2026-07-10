"use client";

import { useMemo, useState } from "react";
import { AddBillModal } from "@/components/bills/AddBillModal";
import { BillCard } from "@/components/bills/BillCard";
import { DeleteBillModal } from "@/components/bills/DeleteBillModal";
import { EditBillModal } from "@/components/bills/EditBillModal";
import { PaycheckSplitPanel } from "@/components/paycheck/PaycheckSplitPanel";
import { Button, EmptyState, PageHeader, SkeletonGrid, StatCard } from "@/components/ui";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  getBillProgressList,
  getMonthlyBills,
  getPaidBills,
  getUpcomingBills,
} from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import type { Bill, BillProgress, FinanceData } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

type BillGroup = {
  bill: Bill;
  splits: BillProgress[];
};

function groupBillProgress(progress: BillProgress[], bills: Bill[]): BillGroup[] {
  const billById = new Map(bills.map((bill) => [bill.id, bill]));
  const groups = new Map<string, BillProgress[]>();

  for (const entry of progress) {
    const existing = groups.get(entry.billId) ?? [];
    existing.push(entry);
    groups.set(entry.billId, existing);
  }

  return Array.from(groups.entries()).flatMap(([billId, splits]) => {
    const bill = billById.get(billId);

    if (!bill) {
      return [];
    }

    return [{ bill, splits }];
  });
}

function BillSection({
  title,
  groups,
  financeData,
  onEdit,
  onDelete,
  onMarkSplitPaid,
}: {
  title: string;
  groups: BillGroup[];
  financeData: FinanceData;
  onEdit: (billId: string) => void;
  onDelete: (billId: string) => void;
  onMarkSplitPaid: (
    billId: string,
    splitId: string,
    amount?: number,
  ) => Promise<void>;
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {groups.map(({ bill, splits }) => (
          <BillCard
            key={bill.id}
            bill={bill}
            splits={splits}
            financeData={financeData}
            onEdit={() => onEdit(bill.id)}
            onDelete={() => onDelete(bill.id)}
            onMarkSplitPaid={(splitId, amount) =>
              onMarkSplitPaid(bill.id, splitId, amount)
            }
          />
        ))}
      </div>
    </section>
  );
}

export function BillsContent() {
  const finance = useFinance();
  const { markBillSplitPaid, isLoading } = finance;
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBillId, setEditBillId] = useState<string | null>(null);
  const [deleteBillId, setDeleteBillId] = useState<string | null>(null);

  const monthlyGroups = useMemo(
    () => groupBillProgress(getMonthlyBills(finance), finance.bills),
    [finance],
  );
  const upcomingGroups = useMemo(
    () => groupBillProgress(getUpcomingBills(finance), finance.bills),
    [finance],
  );
  const paidGroups = useMemo(
    () => groupBillProgress(getPaidBills(finance), finance.bills),
    [finance],
  );
  const summary = finance.dashboard.billsSummary;

  if (isLoading) {
    return <SkeletonGrid count={3} />;
  }

  function findBill(id: string): Bill | null {
    return finance.bills.find((bill) => bill.id === id) ?? null;
  }

  async function handleMarkSplitPaid(
    billId: string,
    splitId: string,
    amount?: number,
  ) {
    const bill = findBill(billId);
    const split = getBillProgressList(finance).find(
      (entry) => entry.billId === billId && entry.splitId === splitId,
    );

    if (!bill || !split) {
      return;
    }

    try {
      await markBillSplitPaid(billId, splitId, amount);

      showToast({
        title:
          amount !== undefined && amount < split.remainingAmount
            ? `${formatCurrency(amount)} recorded`
            : `${split.name} marked paid`,
        subtitle: "Dashboard updated",
        type: "success",
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

      <div className="lg:hidden">
        <MobileCollapsibleSection
          title="Paycheck split"
          description="How bills map to paychecks"
        >
          <PaycheckSplitPanel />
        </MobileCollapsibleSection>
      </div>
      <div className="hidden lg:block">
        <PaycheckSplitPanel />
      </div>

      {finance.bills.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No bills yet"
          description="Add your first bill to track due dates and monthly spending."
          actionLabel="Add bill"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="space-y-[3.25rem] lg:space-y-[4.5rem]">
          <BillSection
            title="Monthly"
            groups={monthlyGroups}
            financeData={finance}
            onEdit={setEditBillId}
            onDelete={setDeleteBillId}
            onMarkSplitPaid={handleMarkSplitPaid}
          />
          <BillSection
            title="Upcoming"
            groups={upcomingGroups}
            financeData={finance}
            onEdit={setEditBillId}
            onDelete={setDeleteBillId}
            onMarkSplitPaid={handleMarkSplitPaid}
          />
          <BillSection
            title="Paid"
            groups={paidGroups}
            financeData={finance}
            onEdit={setEditBillId}
            onDelete={setDeleteBillId}
            onMarkSplitPaid={handleMarkSplitPaid}
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
