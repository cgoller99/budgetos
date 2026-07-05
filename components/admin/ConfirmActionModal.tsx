"use client";

import { Button, Modal } from "@/components/ui";

type ConfirmActionModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmLabel,
  isPending = false,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm leading-relaxed text-white/60">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button size="md" onClick={onConfirm} disabled={isPending}>
          {isPending ? "Working..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
