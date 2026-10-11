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
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
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
import { getBillFrequencyLabel } from "@/lib/recurring/frequencies";
import type { Bill, BillProgress } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";

type BillsTab = "due_soon" | "overdue" | "paid";

function billRowKey(bill: BillProgress) {
  return `${bill.billId}:${bill.splitId}`;
}

function BillRows({
  items,
  empty,
  onOpen,
}: {
  items: BillProgress[];
  empty?: string;
  onOpen: (bill: BillProgress) => void;
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
          key={billRowKey(bill)}
          title={bill.name}
          subtitle={[
            bill.statusLabel,
            bill.formattedDueDate,
            bill.recurring ? "Recurring" : null,
            bill.autopay ? "Autopay" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
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
          trailing={formatCurrency(bill.remainingAmount || bill.amount)}
          onClick={() => {
            void triggerHaptic("selection");
            onOpen(bill);
          }}
          danger={bill.status === "overdue"}
        />
      ))}
    </IosList>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] py-3 last:border-b-0">
      <p className="text-[13px] text-[var(--text-muted)]">{label}</p>
      <p className="max-w-[65%] text-right text-[15px] font-medium text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function BillDetail({
  bill,
  source,
  onMarkPaid,
  onEdit,
}: {
  bill: BillProgress;
  source: Bill | null;
  onMarkPaid: () => void;
  onEdit: () => void;
}) {
  const frequency = source?.frequency ? getBillFrequencyLabel(source.frequency) : null;

  return (
    <div>
      <p className="text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
        {formatCurrency(bill.remainingAmount || bill.amount)}
      </p>
      <p className="mt-2 text-center text-[13px] text-[var(--text-muted)]">
        {bill.status === "paid" ? "Paid" : "Remaining"} · {bill.formattedDueDate}
      </p>
      <div className="mt-5 rounded-[16px] bg-white/[0.04] px-3.5">
        <DetailLine label="Status" value={bill.statusLabel} />
        <DetailLine label="Due" value={bill.formattedDueDate} />
        <DetailLine label="Category" value={bill.category || "Bill"} />
        <DetailLine
          label="Schedule"
          value={
            bill.recurring
              ? frequency
                ? `Recurring · ${frequency}`
                : "Recurring"
              : "One time"
          }
        />
        <DetailLine label="Autopay" value={bill.autopay ? "On" : "Off"} />
        {bill.paidAmount > 0 ? (
          <DetailLine label="Paid so far" value={formatCurrency(bill.paidAmount)} />
        ) : null}
      </div>
      <div className="mt-4 flex gap-2">
        {bill.status !== "paid" ? (
          <button
            type="button"
            className="min-h-12 flex-1 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white active:opacity-90"
            onClick={() => {
              void triggerHaptic("light");
              onMarkPaid();
            }}
          >
            Mark paid
          </button>
        ) : null}
        <button
          type="button"
          className="min-h-12 flex-1 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--foreground)] active:opacity-90"
          onClick={() => {
            void triggerHaptic("light");
            onEdit();
          }}
        >
          Edit
        </button>
      </div>
    </div>
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
  const [selectedBill, setSelectedBill] = useState<BillProgress | null>(null);
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
          onOpen={setSelectedBill}
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

      <IosBottomSheet
        open={selectedBill !== null}
        title={selectedBill?.name}
        onClose={() => setSelectedBill(null)}
      >
        {selectedBill ? (
          <BillDetail
            bill={selectedBill}
            source={bills.find((item) => item.id === selectedBill.billId) ?? null}
            onMarkPaid={() => {
              void handleMarkPaid(selectedBill.billId, selectedBill.splitId);
              setSelectedBill(null);
            }}
            onEdit={() => {
              setEditBillId(selectedBill.billId);
              setSelectedBill(null);
            }}
          />
        ) : null}
      </IosBottomSheet>
      <AddBillModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditBillModal bill={editBill as Bill | null} onClose={() => setEditBillId(null)} />
    </IosScreen>
  );
}
