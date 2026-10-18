"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  FormField,
  Input,
  Modal,
} from "@/components/ui";
import { NativeEditorActions } from "@/components/native/NativeEditorActions";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { SavingsGoal } from "@/lib/finance/types";

type AddMoneyModalProps = {
  goal: SavingsGoal | null;
  onClose: () => void;
};

export function AddMoneyModal({ goal, onClose }: AddMoneyModalProps) {
  const { addMoneyToGoal } = useFinance();
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!goal) {
      setAmount("");
    }
  }, [goal]);

  function handleClose() {
    setAmount("");
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!goal) return;

    const parsedAmount = Number.parseFloat(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    try {
      await addMoneyToGoal({
        goalId: goal.id,
        amount: parsedAmount,
      });

      showToast({
        title: `✓ $${parsedAmount.toLocaleString()} Added`,
        subtitle: `✓ ${goal.name} Updated`,
      });

      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal
      isOpen={Boolean(goal)}
      onClose={handleClose}
      title={goal ? `Add Money to ${goal.name}` : "Add Money"}
     footer={
        <NativeEditorActions
          formId="add-money-form"
          onCancel={handleClose}
          submitLabel="Add Money"
        />
      }>
      <form id="add-money-form" onSubmit={handleSubmit} className="space-y-4">

        <FormField label="Amount">
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            autoFocus
            required
          />
        </FormField>
      </form>
    </Modal>
  );
}
