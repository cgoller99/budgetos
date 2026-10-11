"use client";

import { useMemo, useState } from "react";
import {
  IosAvatar,
  IosBanner,
  IosCard,
  IosPrimaryButton,
  IosProgressBar,
  IosScreen,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
import { AddBillModal } from "@/components/bills/AddBillModal";
import { EditBillModal } from "@/components/bills/EditBillModal";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getBillPaymentHistory } from "@/lib/finance/billPayments";
import {
  getBillProgressList,
  getPaidBills,
  getUpcomingBills,
} from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import { getBillFrequencyLabel } from "@/lib/recurring/frequencies";
import { getLinkedAccountName } from "@/lib/transactions/accountLookup";
import { formatTransactionDate } from "@/lib/transactions";
import type { Bill, BillProgress } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

type BillsTab = "upcoming" | "all" | "recurring";

function billRowKey(bill: BillProgress) {
  return `${bill.billId}:${bill.splitId}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilDue(due: Date | null): number | null {
  if (!due) return null;
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(due);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function duePhrase(bill: BillProgress): string {
  if (bill.status === "paid") return `Paid · ${bill.formattedDueDate}`;
  if (bill.status === "overdue") return `Overdue · ${bill.formattedDueDate}`;
  if (bill.status === "due_today") return "Due today";
  const days = daysUntilDue(bill.dueDate);
  if (days === 1) return "Due tomorrow";
  if (days !== null && days > 1) return `Due in ${days} days`;
  return bill.formattedDueDate || bill.statusLabel;
}

function needsPayChip(bill: BillProgress) {
  return (
    bill.status === "overdue" ||
    bill.status === "due_today" ||
    bill.status === "due_soon"
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
  payments,
  accountName,
  onMarkPaid,
  onEdit,
}: {
  bill: BillProgress;
  source: Bill | null;
  payments: { id: string; amount: number; date: string; notes: string }[];
  accountName: string | null;
  onMarkPaid: () => void;
  onEdit: () => void;
}) {
  const frequency = source?.frequency ? getBillFrequencyLabel(source.frequency) : null;

  return (
    <div>
      <p
        className={cn(
          "text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums",
          bill.status === "overdue" ? "text-[var(--danger)]" : "text-[var(--foreground)]",
        )}
      >
        {formatCurrency(bill.remainingAmount || bill.amount)}
      </p>
      <p
        className={cn(
          "mt-2 text-center text-[13px]",
          bill.status === "overdue" ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
        )}
      >
        {duePhrase(bill)}
      </p>
      <div className="mt-5 rounded-[16px] bg-[var(--surface)] px-3.5">
        <DetailLine
          label="Recurring"
          value={
            bill.recurring
              ? frequency
                ? `Recurring · ${frequency}`
                : "Recurring"
              : "One time"
          }
        />
        <DetailLine label="Autopay" value={bill.autopay ? "On" : "Off"} />
        <DetailLine label="Category" value={bill.category || "Bill"} />
        {accountName ? <DetailLine label="Account" value={accountName} /> : null}
        {bill.paidAmount > 0 ? (
          <DetailLine label="Paid so far" value={formatCurrency(bill.paidAmount)} />
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {bill.status !== "paid" ? (
          <button
            type="button"
            className="min-h-12 w-full rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(59,130,246,0.28)] active:opacity-90"
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
          className="min-h-12 w-full rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--foreground)] active:opacity-90"
          onClick={() => {
            void triggerHaptic("light");
            onEdit();
          }}
        >
          Edit bill
        </button>
      </div>
      <div className="mt-5">
        <p className="px-0.5 text-[13px] font-semibold text-[var(--foreground)]">
          Payment history
        </p>
        {payments.length === 0 ? (
          <p className="mt-2 px-0.5 text-[13px] text-[var(--text-muted)]">
            No recorded payments yet.
          </p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-[16px] bg-[var(--surface)]">
            {payments.slice(0, 6).map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-3.5 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--foreground)]">
                    {payment.notes || bill.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {formatTransactionDate(payment.date)}
                  </p>
                </div>
                <p className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(payment.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
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
  const [tab, setTab] = useState<BillsTab>("upcoming");

  const upcoming = useMemo(() => getUpcomingBills(finance), [finance]);
  const allBills = useMemo(() => {
    const paid = getPaidBills(finance);
    return [...upcoming, ...paid];
  }, [finance, upcoming]);
  const recurring = useMemo(
    () => allBills.filter((bill) => bill.recurring),
    [allBills],
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
  const nextBill = upcoming[0] ?? null;
  const tabItems =
    tab === "all" ? allBills : tab === "recurring" ? recurring : upcoming;

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

  const selectedPayments = selectedBill
    ? getBillPaymentHistory(finance, selectedBill.billId)
    : [];
  const selectedAccount =
    selectedBill?.paymentAccountId
      ? getLinkedAccountName(finance, selectedBill.paymentAccountId)
      : null;

  return (
    <IosScreen>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-muted)]">Total upcoming</p>
          <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
            {formatCurrency(dueTotal)}
          </p>
          <p
            className={cn(
              "mt-2 text-[13px]",
              nextBill?.status === "overdue"
                ? "text-[var(--danger)]"
                : "text-[var(--text-secondary)]",
            )}
          >
            {nextBill ? duePhrase(nextBill) : "Nothing coming up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex size-10 items-center justify-center rounded-[12px] bg-[var(--accent-muted)] text-[var(--accent-light)]"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
              <path d="M8 3v4" />
              <path d="M16 3v4" />
            </svg>
          </span>
          <IosTextButton
            onClick={() => {
              void triggerHaptic("light");
              setCreateOpen(true);
            }}
          >
            Add
          </IosTextButton>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            { value: "upcoming", label: "Upcoming" },
            { value: "all", label: "All" },
            { value: "recurring", label: "Recurring" },
          ] as const
        ).map((option) => {
          const active = tab === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                void triggerHaptic("selection");
                setTab(option.value);
              }}
              className={cn(
                "min-h-9 rounded-full px-3.5 text-[13px] font-semibold active:opacity-80",
                active
                  ? "bg-[var(--accent)] text-white shadow-[0_0_16px_rgba(59,130,246,0.35)]"
                  : "bg-white/[0.06] text-[var(--text-secondary)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {recurringBillCandidates.length > 0 ? (
        <IosBanner
          title={`We found ${recurringBillCandidates.length} possible bill${
            recurringBillCandidates.length === 1 ? "" : "s"
          }`}
          subtitle="Review before adding"
          action={
            <button
              type="button"
              className="min-h-10 shrink-0 rounded-full bg-[var(--accent)] px-3.5 text-[13px] font-semibold text-white active:opacity-90"
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
          <div className="mt-4">
            <IosPrimaryButton
              onClick={() => {
                void triggerHaptic("light");
                setCreateOpen(true);
              }}
            >
              Add bill
            </IosPrimaryButton>
          </div>
        </IosCard>
      ) : tabItems.length === 0 ? (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            {tab === "recurring" ? "No recurring bills" : "Nothing coming up"}
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {tab === "recurring"
              ? "Recurring bills show up here after you add a repeating schedule."
              : "Upcoming bills will show their due dates here."}
          </p>
        </IosCard>
      ) : (
        <ul className="overflow-hidden rounded-[16px] bg-[var(--surface)]">
          {tabItems.map((bill) => (
            <li
              key={billRowKey(bill)}
              className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2.5 last:border-b-0"
            >
              <button
                type="button"
                className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 text-left active:opacity-80"
                onClick={() => {
                  void triggerHaptic("selection");
                  setSelectedBill(bill);
                }}
              >
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
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-[15px] font-medium",
                      bill.status === "overdue"
                        ? "text-[var(--danger)]"
                        : "text-[var(--foreground)]",
                    )}
                  >
                    {bill.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">
                    {duePhrase(bill)}
                    {bill.recurring ? " · Recurring" : ""}
                    {bill.autopay ? " · Autopay" : ""}
                  </span>
                </span>
              </button>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(bill.remainingAmount || bill.amount)}
              </span>
              {needsPayChip(bill) ? (
                <button
                  type="button"
                  className="min-h-8 shrink-0 rounded-full bg-[var(--accent)] px-3 text-[13px] font-semibold text-white active:opacity-80"
                  onClick={() => {
                    void handleMarkPaid(bill.billId, bill.splitId);
                  }}
                >
                  Pay
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {tab !== "all" && allBills.length > tabItems.length ? (
        <IosPrimaryButton
          onClick={() => {
            void triggerHaptic("selection");
            setTab("all");
          }}
        >
          View all bills
        </IosPrimaryButton>
      ) : null}

      <IosCard padding="md">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-[var(--text-muted)]">Paid this month</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(paidTotal)}
            </p>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]">
            Due {formatCurrency(dueTotal)}
          </p>
        </div>
        <IosProgressBar value={paidProgress} className="mt-3" />
      </IosCard>

      <IosBottomSheet
        open={selectedBill !== null}
        title={selectedBill?.name}
        onClose={() => setSelectedBill(null)}
      >
        {selectedBill ? (
          <BillDetail
            bill={selectedBill}
            source={bills.find((item) => item.id === selectedBill.billId) ?? null}
            payments={selectedPayments}
            accountName={selectedAccount}
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
