"use client";

import { useMemo, useState } from "react";
import {
  IosBanner,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
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
import type { Bill } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";

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
          bill.status === "partial",
      ),
    [upcoming],
  );
  const later = useMemo(
    () => upcoming.filter((bill) => bill.status === "upcoming"),
    [upcoming],
  );
  const paid = useMemo(() => getPaidBills(finance).slice(0, 6), [finance]);
  const recurring = useMemo(
    () =>
      getBillProgressList(finance)
        .filter((bill) => bill.recurring)
        .slice(0, 6),
    [finance],
  );

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

  function BillRows({
    items,
    empty,
  }: {
    items: ReturnType<typeof getUpcomingBills>;
    empty?: string;
  }) {
    if (items.length === 0) {
      return empty ? (
        <p className="px-1 text-[13px] text-[var(--text-muted)]">{empty}</p>
      ) : null;
    }

    return (
      <IosList>
        {items.map((bill) => (
          <IosListRow
            key={`${bill.billId}-${bill.splitId}`}
            title={bill.name}
            subtitle={`${bill.statusLabel} · ${bill.formattedDueDate}`}
            trailing={
              <div className="flex flex-col items-end gap-1">
                <span>{formatCurrency(bill.remainingAmount || bill.amount)}</span>
                {bill.status !== "paid" ? (
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-[var(--accent-light)]"
                    onClick={() => void handleMarkPaid(bill.billId, bill.splitId)}
                  >
                    Mark paid
                  </button>
                ) : null}
              </div>
            }
            onClick={() => setEditBillId(bill.billId)}
            danger={bill.status === "overdue"}
          />
        ))}
      </IosList>
    );
  }

  return (
    <IosScreen>
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-muted)]">
            What do I have to pay?
          </p>
          <p className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            {overdue.length + dueSoon.length > 0
              ? `${overdue.length + dueSoon.length} due soon`
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

      {recurringBillCandidates.length > 0 ? (
        <IosBanner
          title={`We found ${recurringBillCandidates.length} possible bill${
            recurringBillCandidates.length === 1 ? "" : "s"
          }`}
          subtitle="Review before adding"
          action={
            <button
              type="button"
              className="min-h-11 shrink-0 px-2 text-[13px] font-semibold text-[var(--accent-light)]"
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
        <IosSection>
          <IosList>
            <IosListRow
              title="Add your first bill"
              subtitle="Due dates and monthly totals appear here"
              onClick={() => setCreateOpen(true)}
              trailing={<span className="text-[var(--accent-light)]">›</span>}
            />
          </IosList>
        </IosSection>
      ) : (
        <>
          {overdue.length > 0 ? (
            <IosSection title="Overdue">
              <BillRows items={overdue} />
            </IosSection>
          ) : null}

          <IosSection title="Due soon">
            <BillRows items={dueSoon} empty="Nothing due in the next few days." />
          </IosSection>

          {later.length > 0 ? (
            <IosSection title="Upcoming">
              <BillRows items={later.slice(0, 5)} />
            </IosSection>
          ) : null}

          {paid.length > 0 ? (
            <IosSection title="Paid this month">
              <IosList>
                {paid.map((bill) => (
                  <IosListRow
                    key={`${bill.billId}-${bill.splitId}`}
                    title={bill.name}
                    subtitle={bill.formattedDueDate}
                    trailing={formatCurrency(bill.amount)}
                    onClick={() => setEditBillId(bill.billId)}
                  />
                ))}
              </IosList>
            </IosSection>
          ) : null}

          {recurring.length > 0 ? (
            <IosSection title="Recurring">
              <IosList>
                {recurring.map((bill) => (
                  <IosListRow
                    key={`${bill.billId}-${bill.splitId}-recurring`}
                    title={bill.name}
                    subtitle={bill.statusLabel}
                    trailing={formatCurrency(bill.amount)}
                    onClick={() => setEditBillId(bill.billId)}
                  />
                ))}
              </IosList>
            </IosSection>
          ) : null}
        </>
      )}

      <AddBillModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditBillModal bill={editBill as Bill | null} onClose={() => setEditBillId(null)} />
    </IosScreen>
  );
}
