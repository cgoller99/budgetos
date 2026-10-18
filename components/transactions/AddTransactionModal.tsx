"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  getDefaultTransactionFormState,
  parseTransactionForm,
  TransactionFormFields,
} from "@/components/transactions/TransactionFormFields";
import { Modal } from "@/components/ui";
import { NativeEditorActions } from "@/components/native/NativeEditorActions";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { validateTransactionInput } from "@/lib/transactions";

type AddTransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AddTransactionModal({ isOpen, onClose }: AddTransactionModalProps) {
  const finance = useFinance();
  const { addTransaction } = finance;
  const { showToast } = useToast();
  const initialState = useMemo(
    () => getDefaultTransactionFormState(finance.accounts),
    [finance.accounts],
  );
  const [form, setForm] = useState(initialState);

  function handleClose() {
    setForm(getDefaultTransactionFormState(finance.accounts));
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      await addTransaction(parsed);
      showToast({
        title: "✓ Transaction Added",
        subtitle: "✓ Dashboard Updated",
      });
      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Transaction" footer={
        <NativeEditorActions
          formId="save-transaction-form"
          onCancel={handleClose}
          submitLabel="Save Transaction"
        />
      }>
      <form id="save-transaction-form" onSubmit={(event) =>
 void handleSubmit(event)} className="space-y-4">
        <TransactionFormFields
          form={form}
          accounts={finance.accounts}
          goals={finance.savingsGoals}
          onChange={setForm}
        />
      </form>
    </Modal>
  );
}
