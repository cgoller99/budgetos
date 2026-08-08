"use client";

import { useMemo, useState } from "react";
import {
  IosAvatar,
  IosBanner,
  IosCard,
  IosList,
  IosListRow,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSegmentedControl,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { AddBillModal } from "@/components/bills/AddBillModal";
import { EditBillModal } from "@/components/bills/EditBillModal";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  getBillProgressList,
  getPaidBills,
  getUpcomingBills,
} from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import type { Bill, BillProgress } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";

type BillsTab = "due_soon" | "overdue" | "paid";

function BillRows({
  items,
  empty,
  onEdit,
  onMarkPaid,
}: {
  items: BillProgress[];
  empty?: string;
  onEdit: (billId: string) => void;
  onMarkPaid: (billId: string, splitId: string) => void;
}) {
  if (items.length === 0) {
    return empty ? (
      <IosCard padding="md">
        <p className="text-[13px] text-[var(--text-muted)]">{empty}</p>
      </IosCard>
    ) : null;
  }

  return (
    <IosList>
      {items.map((bill) => (
        <IosListRow
          key={`${bill.billId}-${bill.splitId}`}
          title={bill.name}
          subtitle={`${bill.statusLabel} · ${bill.formattedDueDate}`}
          leading={
            <IosAvatar
              fallback={bill.name.slice(0, 1).toUpperCase()}
              tone={
                bill.status === "overdue"
                  ? "danger"
                  : bill.status === "paid"
                    ? "success"
                    : "accent"
              }
            />
          }
          trailing={
            <div className="flex flex-col items-end gap-1">
              <span>{formatCurrency(bill.remainingAmount || bill.amount)}</span>
              {bill.status !== "paid" ? (
                <button
                  type="button"
                  className="text-[12px] font-semibold text-[var(--accent-light)]"
                  onClick={() => onMarkPaid(bill.billId, bill.splitId)}
                >
                  Mark paid
                </button>
              ) : null}
            </div>
          }
          onClick={() => onEdit(bill.billId)}
          danger={bill.status === "overdue"}
        />
      ))}
    </IosList>
  );
}

export function IosBillsScreen() {
  const finance = useFinance();
  const {
    isLoading,
    bills,
    markBillSplitPaid,
    recurringBillCandidates,
    openRecurringBillsModal,
  } = finance;
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editBillId, setEditBillId] = useState<string | null>(null);
  const [tab, setTab] = useState<BillsTab>("due_soon");

  const upcoming = useMemo(() => getUpcomingBills(finance), [finance]);
  const overdue = useMemo(
    () => upcoming.filter((bill) => bill.status === "overdue"),
    [upcoming],
  );
  const dueSoon = useMemo(
    () =>
      upcoming.filter(
        (bill) =>
          bill.status === "due_soon" ||
          bill.status === "due_today" ||
          bill.status === "partial" ||
          bill.status === "upcoming",
      ),
    [upcoming],
  );
  const paid = useMemo(() => getPaidBills(finance), [finance]);

  const paidTotal = useMemo(
    () => paid.reduce((sum, bill) => sum + bill.amount, 0),
    [paid],
  );
  const dueTotal = useMemo(
    () => upcoming.reduce((sum, bill) => sum + (bill.remainingAmount || bill.amount), 0),
    [upcoming],
  );
  const overviewTotal = paidTotal + dueTotal || 1;
  const paidProgress = (paidTotal / overviewTotal) * 100;

  if (isLoading) {
    return <IosSkeletonScreen rows={6} />;
  }

  const editBill =
    editBillId !== null
      ? (bills.find((bill) => bill.id === editBillId) ?? null)
      : null;

  async function handleMarkPaid(billId: string, splitId: string) {
    const split = getBillProgressList(finance).find(
      (entry) => entry.billId === billId && entry.splitId === splitId,
    );
    if (!split) return;

    try {
      await markBillSplitPaid(billId, splitId);
      void triggerHaptic("success");
      showToast({
        title: `${split.name} marked paid`,
        type: "success",
      });
    } catch {
      // FinanceContext toast
    }
  }

  const tabItems =
    tab === "overdue" ? overdue : tab === "paid" ? paid : dueSoon;

  return (
    <IosScreen>
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-muted)]">Bills</p>
          <p className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            {overdue.length > 0
              ? `${overdue.length} overdue`
              : dueSoon.length > 0
                ? `${dueSoon.length} due soon`
                : "All clear"}
          </p>
        </div>
        <IosTextButton
          onClick={() => {
            void triggerHaptic("light");
            setCreateOpen(true);
          }}
        >
          Add
        </IosTextButton>
      </div>

      <IosSegmentedControl
        value={tab}
        onChange={(value) => {
          void triggerHaptic("selection");
          setTab(value);
        }}
        options={[
          { value: "due_soon", label: "Due Soon" },
          { value: "overdue", label: "Overdue" },
          { value: "paid", label: "Paid" },
        ]}
      />

      {recurringBillCandidates.length > 0 ? (
        <IosBanner
          title={`We found ${recurringBillCandidates.length} possible bill${
            recurringBillCandidates.length === 1 ? "" : "s"
          }`}
          subtitle="Review before adding"
          action={
            <button
              type="button"
              className="min-h-10 shrink-0 rounded-full bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-white"
              onClick={() => {
                void triggerHaptic("light");
                openRecurringBillsModal();
              }}
            >
              Review
            </button>
          }
        />
      ) : null}

      {bills.length === 0 ? (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            No upcoming bills
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Add bills to track due dates and monthly totals.
          </p>
          <button
            type="button"
            className="mt-4 min-h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white"
            onClick={() => {
              void triggerHaptic("light");
              setCreateOpen(true);
            }}
          >
            Add bill
          </button>
        </IosCard>
      ) : (
        <BillRows
          items={tabItems}
          empty={
            tab === "overdue"
              ? "Nothing overdue."
              : tab === "paid"
                ? "No paid bills this month yet."
                : "Nothing due soon."
          }
          onEdit={setEditBillId}
          onMarkPaid={(billId, splitId) => void handleMarkPaid(billId, splitId)}
        />
      )}

      <IosCard padding="md" className="border-[var(--success)]/20 bg-[var(--success)]/10">
        <p className="text-[12px] font-medium text-[var(--success)]">Paid This Month</p>
        <p className="mt-1 text-[28px] font-semibold tabular-nums text-[var(--foreground)]">
          {formatCurrency(paidTotal)}
        </p>
      </IosCard>

      <IosSection title="Bills Overview">
        <IosCard padding="md">
          <div className="mb-2 flex items-center justify-between gap-3 text-[12px]">
            <span className="text-[var(--text-muted)]">
              Total due {formatCurrency(dueTotal)}
            </span>
            <span className="text-[var(--success)]">
              Paid {formatCurrency(paidTotal)}
            </span>
          </div>
          <IosProgressBar value={paidProgress} tone="success" />
        </IosCard>
      </IosSection>

      <AddBillModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditBillModal bill={editBill as Bill | null} onClose={() => setEditBillId(null)} />
    </IosScreen>
  );
}
