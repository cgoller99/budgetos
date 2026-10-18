"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BillFormFields,
  billToFormState,
  initialBillFormState,
  parseBillForm,
} from "@/components/bills/BillFormFields";
import { DeleteBillModal } from "@/components/bills/DeleteBillModal";
import { Button, Modal } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { Bill } from "@/lib/finance/types";

type EditBillModalProps = {
  bill: Bill | null;
  onClose: () => void;
  /** @deprecated Delete Bill is always built into this editor. */
  onRemove?: () => void;
};

/**
 * Bill editor used by iOS and desktop.
 * A solid red "Delete Bill" control is always pinned in a sticky footer so it
 * cannot sit behind the keyboard, tab bar, or home-indicator safe area.
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
      >
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 pb-4">
            <BillFormFields form={form} onChange={setForm} />
          </div>

          <div
            data-bill-editor-footer="true"
            className={cn(
              "sticky bottom-0 z-10 -mx-4 mt-2 border-t border-white/[0.08] bg-[var(--surface)] px-4 pt-3",
              "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              "sm:mx-0 sm:px-0 sm:pb-1",
            )}
          >
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" fullWidth disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>

            <button
              type="button"
              data-bill-delete="true"
              aria-label="Delete Bill"
              disabled={isSubmitting || !bill}
              onClick={() => setConfirmDelete(true)}
              className={cn(
                "mt-3 flex min-h-12 w-full items-center justify-center rounded-[14px]",
                "bg-rose-500 text-[16px] font-semibold text-white",
                "shadow-[0_8px_20px_rgba(244,63,94,0.35)]",
                "active:opacity-90 hover:bg-rose-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Delete Bill
            </button>
            <p className="mt-2 text-center text-[11px] leading-snug text-white/45">
              Removes this bill from your list. Payment history and bank
              transactions stay.
            </p>
          </div>
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
