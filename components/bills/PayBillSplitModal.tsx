"use client";

import { useState } from "react";
import { Button, FormField, Input, Modal } from "@/components/ui";
import { formatCurrency } from "@/lib/finance/format";
import type { BillProgress } from "@/lib/finance/types";

type PayBillSplitModalProps = {
  split: BillProgress | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
  isSubmitting?: boolean;
};

export function PayBillSplitModal({
  split,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: PayBillSplitModalProps) {
  const [amount, setAmount] = useState("");

  if (!split) {
    return null;
  }

  const remaining = split.remainingAmount;
  const parsedAmount = Number.parseFloat(amount);
  const isValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= remaining + 0.001;

  async function handleSubmit() {
    if (!isValid) {
      return;
    }

    await onConfirm(parsedAmount);
    setAmount("");
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setAmount("");
        onClose();
      }}
      title="Record payment"
    >
      <p className="text-sm text-white/45">{split.name}</p>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/45">Total due</span>
            <span className="font-medium text-white">
              {formatCurrency(split.amount)}
            </span>
          </div>
          {split.paidAmount > 0 && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-white/45">Already paid</span>
              <span className="font-medium text-emerald-400">
                {formatCurrency(split.paidAmount)}
              </span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-white/45">Remaining</span>
            <span className="font-semibold text-white">
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>

        <FormField label="Payment amount">
          <Input
            type="number"
            min={0.01}
            max={remaining}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={remaining.toFixed(2)}
          />
        </FormField>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAmount(remaining.toFixed(2))}
          >
            Pay full amount
          </Button>
          {remaining > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAmount((remaining / 2).toFixed(2))}
            >
              Pay half
            </Button>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAmount("");
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Record payment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
