"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/finance/format";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { getLinkedAccountName } from "@/lib/transactions/accountLookup";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";
import { formatTransactionDate, getTransactionTypeLabel } from "@/lib/transactions";
import {
  getDisplayCategory,
  getDisplayMerchant,
} from "@/lib/transactions/categoryPresentation";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

type IosTransactionDetailSheetProps = {
  transaction: Transaction | null;
  finance: FinanceData;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] py-3 last:border-b-0">
      <p className="text-[13px] text-[var(--text-muted)]">{label}</p>
      <p className="max-w-[65%] text-right text-[15px] font-medium text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

export function IosTransactionDetailSheet({
  transaction,
  finance,
  onClose,
  onEdit,
  onDelete,
}: IosTransactionDetailSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [presented, setPresented] = useState<Transaction | null>(transaction);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOrigin = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (transaction) {
      setPresented(transaction);
      setVisible(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setAnimating(true));
      });
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onCloseRef.current();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.cancelAnimationFrame(frame);
        document.body.style.overflow = previousOverflow;
        window.removeEventListener("keydown", onKeyDown);
      };
    }

    setAnimating(false);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => {
      setVisible(false);
      setPresented(null);
    }, reduceMotion ? 0 : 220);
    return () => window.clearTimeout(timeout);
  }, [transaction]);

  function setDrag(next: number) {
    dragOffsetRef.current = next;
    setDragOffset(next);
  }

  function endDrag() {
    const shouldClose = dragOffsetRef.current > 96;
    dragOrigin.current = null;
    setDrag(0);
    if (shouldClose) onCloseRef.current();
  }

  const shown = transaction ?? presented;

  if (!visible || !shown || typeof document === "undefined") {
    return null;
  }

  const isTransfer = isConfidentInternalTransfer(finance, shown);
  const isIncome = shown.type === "income" && !isTransfer;
  const label = getDisplayMerchant({
    notes: shown.notes,
    category: shown.category,
    type: isTransfer ? "transfer" : shown.type,
  });
  const category = isTransfer ? "Transfer" : getDisplayCategory(shown.category);
  const accountName = getLinkedAccountName(finance, shown.accountId);
  const transferName = shown.transferAccountId
    ? getLinkedAccountName(finance, shown.transferAccountId)
    : null;
  const billName = shown.billId
    ? finance.bills.find((bill) => bill.id === shown.billId)?.name
    : null;
  const goalName = shown.goalId
    ? finance.savingsGoals.find((goal) => goal.id === shown.goalId)?.name
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close transaction"
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onCloseRef.current()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Transaction details"
        className={cn(
          "native-sheet absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[22px] border border-white/[0.08] border-b-0 bg-[#0b0f14] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 transition-transform duration-200 ease-out",
          animating ? "translate-y-0" : "translate-y-full",
        )}
        style={
          dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)`, transition: "none" }
            : undefined
        }
      >
        <div
          className="mx-auto mb-2 flex h-7 w-full touch-none items-center justify-center"
          data-sheet-handle="true"
          onPointerDown={(event) => {
            dragOrigin.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragOrigin.current == null) return;
            setDrag(Math.max(0, event.clientY - dragOrigin.current));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>

        <p
          className={cn(
            "text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums",
            isIncome ? "text-[var(--success)]" : isTransfer ? "text-[var(--foreground)]" : "text-[var(--danger)]",
          )}
        >
          {isIncome ? "+" : isTransfer ? "" : "−"}
          {formatCurrency(Math.abs(shown.amount))}
        </p>
        <p className="mt-2 text-center text-[17px] font-semibold text-[var(--foreground)]">
          {label}
        </p>
        <p className="mt-1 text-center text-[13px] text-[var(--text-muted)]">
          {formatTransactionDate(shown.date)}
        </p>

        <div className="mt-5 rounded-[16px] bg-white/[0.04] px-3.5">
          <DetailRow label="Category" value={category} />
          <DetailRow label="Type" value={isTransfer ? "Transfer" : getTransactionTypeLabel(shown.type)} />
          <DetailRow label="Account" value={accountName} />
          {transferName ? <DetailRow label="Transfer to" value={transferName} /> : null}
          {billName ? <DetailRow label="Bill" value={billName} /> : null}
          {goalName ? <DetailRow label="Goal" value={goalName} /> : null}
          {shown.notes.trim() ? <DetailRow label="Notes" value={shown.notes} /> : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-12 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white active:opacity-90"
            onClick={() => {
              void triggerHaptic("light");
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="min-h-12 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--danger)] active:opacity-90"
            onClick={() => {
              void triggerHaptic("light");
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
