"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/finance/format";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { getLinkedAccountName } from "@/lib/transactions/accountLookup";
import { isDisplayedInflow, isRefundActivity } from "@/lib/transactions/refunds";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";
import { formatTransactionDate, getTransactionTypeLabel } from "@/lib/transactions";
import {
  getDisplayCategory,
  getDisplayMerchant,
} from "@/lib/transactions/categoryPresentation";
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
import { IosAvatar } from "@/components/native/ios/IosPrimitives";
import { IosMerchantMark } from "@/components/native/ios/IosMerchantMark";
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

/**
 * Transaction detail — scrollable body + fixed Edit/Delete footer via IosBottomSheet.
 */
export function IosTransactionDetailSheet({
  transaction,
  finance,
  onClose,
  onEdit,
  onDelete,
}: IosTransactionDetailSheetProps) {
  const [presented, setPresented] = useState<Transaction | null>(transaction);

  useEffect(() => {
    if (transaction) {
      setPresented(transaction);
    }
  }, [transaction]);

  const shown = transaction ?? presented;
  if (!shown) {
    return null;
  }

  const isTransfer = isConfidentInternalTransfer(finance, shown);
  const isRefund = !isTransfer && isRefundActivity(shown);
  const isInflow = !isTransfer && isDisplayedInflow(shown);
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

  return (
    <IosBottomSheet
      open={transaction !== null}
      onClose={onClose}
      labelledBy="ios-transaction-detail-title"
      footer={
        <div className="grid grid-cols-2 gap-2" data-transaction-detail-footer="true">
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
      }
    >
      <div className="pb-2">
        <div className="mb-3 flex justify-center">
          <IosAvatar
            fallback={
              <IosMerchantMark
                category={category}
                kind={
                  isTransfer ? "transfer" : isRefund ? "refund" : isInflow ? "income" : "spending"
                }
              />
            }
            tone={isRefund || isInflow ? "success" : isTransfer ? "muted" : "accent"}
          />
        </div>
        <p
          className={cn(
            "text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums",
            isRefund || isInflow
              ? "text-[var(--success)]"
              : "text-[var(--foreground)]",
          )}
        >
          {isInflow ? "+" : isTransfer ? "" : "−"}
          {formatCurrency(Math.abs(shown.amount))}
        </p>
        <p
          id="ios-transaction-detail-title"
          className="mt-2 text-center text-[17px] font-semibold text-[var(--foreground)]"
        >
          {label}
        </p>
        <p className="mt-1 text-center text-[13px] text-[var(--text-muted)]">
          {formatTransactionDate(shown.date)}
        </p>

        <div className="mt-5 rounded-[16px] bg-white/[0.04] px-3.5">
          <DetailRow label="Category" value={category} />
          <DetailRow
            label="Type"
            value={
              isTransfer
                ? "Transfer"
                : isRefund
                  ? "Refund"
                  : getTransactionTypeLabel(shown.type)
            }
          />
          <DetailRow label="Account" value={accountName} />
          {transferName ? <DetailRow label="Transfer to" value={transferName} /> : null}
          {billName ? <DetailRow label="Bill" value={billName} /> : null}
          {goalName ? <DetailRow label="Goal" value={goalName} /> : null}
          {shown.notes.trim() ? <DetailRow label="Notes" value={shown.notes} /> : null}
        </div>
      </div>
    </IosBottomSheet>
  );
}
