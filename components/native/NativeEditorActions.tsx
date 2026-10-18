"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";

type NativeEditorActionsProps = {
  onCancel: () => void;
  submitLabel?: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  /** When set, Save submits this form id (fields live in Modal body). */
  formId?: string;
  destructive?: ReactNode;
  className?: string;
};

/**
 * Shared Save / Cancel (+ optional Delete) chrome for native editors.
 * Pair with Modal `footer` or IosBottomSheet `footer` — never sticky-inside-scroll.
 */
export function NativeEditorActions({
  onCancel,
  submitLabel = "Save",
  submittingLabel = "Saving…",
  isSubmitting = false,
  submitDisabled = false,
  formId,
  destructive,
  className,
}: NativeEditorActionsProps) {
  return (
    <div className={cn("space-y-3", className)} data-native-editor-actions="true">
      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-12"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form={formId}
          fullWidth
          disabled={isSubmitting || submitDisabled}
          className="min-h-12"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
      {destructive}
    </div>
  );
}

type NativeDestructiveButtonProps = {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  /** Marks bill delete for tests (`data-bill-delete`). */
  billDelete?: boolean;
};

export function NativeDestructiveButton({
  label = "Delete",
  onClick,
  disabled = false,
  hint,
  billDelete = false,
}: NativeDestructiveButtonProps) {
  return (
    <div>
      <button
        type="button"
        data-bill-delete={billDelete ? "true" : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex min-h-12 w-full items-center justify-center rounded-[14px]",
          "bg-rose-500 text-[16px] font-semibold text-white",
          "shadow-[0_8px_20px_rgba(244,63,94,0.28)]",
          "active:opacity-90 hover:bg-rose-600",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {label}
      </button>
      {hint ? (
        <p className="mt-2 text-center text-[11px] leading-snug text-white/45">{hint}</p>
      ) : null}
    </div>
  );
}
