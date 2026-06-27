"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  parseTransactionForm,
  transactionToFormState,
  TransactionFormFields,
} from "@/components/transactions/TransactionFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { Transaction } from "@/lib/finance/types";
import { validateTransactionInput } from "@/lib/transactions";

type EditTransactionModalProps = {
  transaction: Transaction | null;
  onClose: () => void;
};

export function EditTransactionModal({
  transaction,
  onClose,
}: EditTransactionModalProps) {
  const finance = useFinance();
  const { editTransaction } = finance;
  const { showToast } = useToast();
  const [form, setForm] = useState(
    transaction ? transactionToFormState(transaction) : null,
  );

  useEffect(() => {
    setForm(transaction ? transactionToFormState(transaction) : null);
  }, [transaction]);

  function handleClose() {
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!transaction || !form) {
      return;
    }

    const parsed = parseTransactionForm(form);

    if (!parsed) {
      return;
    }

    const validationError = validateTransactionInput(parsed);

    if (validationError) {
      showToast({ title: "Unable to save", subtitle: validationError });
      return;
    }

    try {
      await editTransaction(transaction.id, parsed);
      showToast({
        title: "✓ Transaction Updated",
        subtitle: "✓ Dashboard Updated",
      });
      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal
      isOpen={Boolean(transaction && form)}
      onClose={handleClose}
      title="Edit Transaction"
    >
      {form && (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <TransactionFormFields
            form={form}
            accounts={finance.accounts}
            goals={finance.savingsGoals}
            onChange={setForm}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button type="submit" fullWidth>
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
