"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
} from "@/components/ui";
import { BillPaymentHistory } from "@/components/bills/BillPaymentHistory";
import { PayBillSplitModal } from "@/components/bills/PayBillSplitModal";
import { formatCurrency } from "@/lib/finance/format";
import { getBillStatusVariant } from "@/lib/finance/bills";
import type { Bill, BillProgress, FinanceData } from "@/lib/finance/types";

type BillCardProps = {
  bill: Bill;
  splits: BillProgress[];
  financeData: FinanceData;
  onEdit: () => void;
  onDelete: () => void;
  onMarkSplitPaid: (splitId: string, amount?: number) => Promise<void>;
};

export function BillCard({
  bill,
  splits,
  financeData,
  onEdit,
  onDelete,
  onMarkSplitPaid,
}: BillCardProps) {
  const [paySplit, setPaySplit] = useState<BillProgress | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const allPaid = splits.every((split) => split.status === "paid");

  async function handleConfirmPayment(amount: number) {
    if (!paySplit) {
      return;
    }

    setIsPaying(true);

    try {
      await onMarkSplitPaid(paySplit.splitId, amount);
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <>
      <Card hover className="bill-card-enter overflow-hidden">
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="truncate text-lg font-semibold tracking-tight text-white">
                  {bill.name}
                </h3>
                {allPaid && <Badge variant="success">Paid</Badge>}
              </div>
              <p className="mt-2 text-sm text-white/38">
                {bill.recurring ? "Recurring" : "One-time"}
                {bill.autopay ? " · Autopay" : ""}
                {splits.length > 1 ? ` · ${splits.length} payments` : ""}
              </p>
            </div>
            <p className="shrink-0 text-xl font-semibold tabular-nums text-white">
              {formatCurrency(bill.amount)}
            </p>
          </div>

          <ul className="mt-6 space-y-3 border-t border-white/[0.04] pt-6">
            {splits.map((split) => {
              const isPaid = split.status === "paid";
              const isPartial = split.status === "partial";

              return (
                <li
                  key={split.splitId}
                  className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="text-sm font-medium text-white">
                        {split.splitCount > 1 ? split.name : "Payment"}
                      </p>
                      <Badge variant={getBillStatusVariant(split.status)}>
                        {split.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-white/38">
                      {split.formattedDueDate}
                    </p>
                    {isPartial && (
                      <p className="mt-1 text-xs text-amber-300/80">
                        {formatCurrency(split.paidAmount)} paid ·{" "}
                        {formatCurrency(split.remainingAmount)} remaining
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-semibold tabular-nums text-white">
                        {formatCurrency(split.amount)}
                      </p>
                      {isPartial && (
                        <p className="text-xs text-white/38">
                          {formatCurrency(split.remainingAmount)} due
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setPaySplit(split)}
                      disabled={isPaid}
                    >
                      {isPartial ? "Pay more" : "Mark paid"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <BillPaymentHistory bill={bill} data={financeData} />

          <div className="mt-6 flex flex-wrap gap-3 border-t border-white/[0.04] pt-6">
            <Button type="button" variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              className="text-rose-400/90 hover:text-rose-300"
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <PayBillSplitModal
        split={paySplit}
        isOpen={paySplit !== null}
        onClose={() => setPaySplit(null)}
        onConfirm={handleConfirmPayment}
        isSubmitting={isPaying}
      />
    </>
  );
}
