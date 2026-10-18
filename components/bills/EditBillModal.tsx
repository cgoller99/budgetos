"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BillFormFields,
  billToFormState,
  initialBillFormState,
  parseBillForm,
} from "@/components/bills/BillFormFields";
import { DeleteBillModal } from "@/components/bills/DeleteBillModal";
import {
  NativeDestructiveButton,
  NativeEditorActions,
} from "@/components/native/NativeEditorActions";
import { Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { Bill } from "@/lib/finance/types";

const EDIT_BILL_FORM_ID = "edit-bill-form";

type EditBillModalProps = {
  bill: Bill | null;
  onClose: () => void;
  /** @deprecated Delete Bill is always built into this editor. */
  onRemove?: () => void;
};

/**
 * Bill editor — scrollable fields + fixed footer (Save/Cancel + Delete Bill).
 * Footer is Modal chrome (not sticky-inside-scroll), so it stays clear of the
 * keyboard, tab bar, and safe-area inset.
 */
export function EditBillModal({ bill, onClose }: EditBillModalProps) {
  const { editBill } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(() =>
    bill ? billToFormState(bill) : initialBillFormState,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (bill) {
      setForm(billToFormState(bill));
      setConfirmDelete(false);
    }
  }, [bill]);

  function handleClose() {
    setConfirmDelete(false);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bill) {
      return;
    }

    const parsed = parseBillForm(form);

    if (!parsed) {
      showToast({
        title: "Check bill details",
        subtitle: "Name, category, amount, and due day are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await editBill(bill.id, parsed);

      showToast({
        title: `✓ ${parsed.name.trim()} Updated`,
        subtitle: "✓ Dashboard Updated",
        type: "success",
      });

      handleClose();
    } catch {
      // FinanceContext toast
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={bill !== null && !confirmDelete}
        onClose={handleClose}
        title="Edit Bill"
        footer={
          <div data-bill-editor-footer="true">
            <NativeEditorActions
              formId={EDIT_BILL_FORM_ID}
              onCancel={handleClose}
              isSubmitting={isSubmitting}
              destructive={
                <NativeDestructiveButton
                  label="Delete Bill"
                  billDelete
                  disabled={isSubmitting || !bill}
                  onClick={() => setConfirmDelete(true)}
                  hint="Removes this bill from your list. Payment history and bank transactions stay."
                />
              }
            />
          </div>
        }
      >
        <form
          id={EDIT_BILL_FORM_ID}
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
          data-bill-editor-fields="true"
        >
          <BillFormFields form={form} onChange={setForm} />
        </form>
      </Modal>

      <DeleteBillModal
        bill={confirmDelete ? bill : null}
        onClose={() => setConfirmDelete(false)}
        onCancel={() => setConfirmDelete(false)}
        onDeleted={() => {
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}
