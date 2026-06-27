"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, FormField, Input, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import type { Debt } from "@/lib/finance/types";

type MakePaymentModalProps = {
  debt: Debt | null;
  onClose: () => void;
};

export function MakePaymentModal({ debt, onClose }: MakePaymentModalProps) {
  const { makeDebtPayment } = useFinance();
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (debt) {
      setAmount(String(debt.minimumPayment));
    }
  }, [debt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!debt) {
      return;
    }

    const paymentAmount = Number.parseFloat(amount);

    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      return;
    }

    try {
      await makeDebtPayment(debt.id, paymentAmount);

      showToast({
        title: `✓ ${debt.name} Payment Applied`,
        subtitle: "✓ Dashboard Updated",
      });

      onClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={debt !== null} onClose={onClose} title="Make Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-white/60">
          Current balance:{" "}
          <span className="font-medium text-white">
            {formatCurrency(debt?.balance ?? 0)}
          </span>
        </p>

        <FormField label="Payment Amount">
          <Input
            type="number"
            step="0.01"
            min="0"
            max={debt?.balance ?? undefined}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Apply Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
