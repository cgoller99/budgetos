"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BillFormFields,
  initialBillFormState,
  parseBillForm,
  type BillFormState,
} from "@/components/bills/BillFormFields";
import { Modal } from "@/components/ui";
import { NativeEditorActions } from "@/components/native/NativeEditorActions";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";

type AddBillModalProps = {
  isOpen: boolean;
  onClose: () => void;
  draft?: BillFormState | null;
};

export function AddBillModal({ isOpen, onClose, draft = null }: AddBillModalProps) {
  const { addBill } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(initialBillFormState);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(draft ?? initialBillFormState);
  }, [isOpen, draft]);

  function handleClose() {
    setForm(initialBillFormState);
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseBillForm(form);

    if (!parsed) {
      return;
    }

    addBill(parsed);

    showToast({
      title: `✓ ${parsed.name.trim()} Bill Added`,
      subtitle: "✓ Dashboard Updated",
    });

    handleClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Bill" footer={
        <NativeEditorActions
          formId="save-bill-form"
          onCancel={handleClose}
          submitLabel="Save Bill"
        />
      }>
      <form id="save-bill-form" onSubmit={handleSubmit} className="space-y-4">

        <BillFormFields form={form} onChange={setForm} />
      </form>
    </Modal>
  );
}
