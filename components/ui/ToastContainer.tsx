"use client";

import type { ToastMessage, ToastType } from "@/context/ToastContext";
import { cn } from "./cn";

type ToastContainerProps = {
  toasts: ToastMessage[];
};

const toastStyles: Record<
  ToastType,
  { border: string; icon: string; title: string }
> = {
  success: {
    border: "border-emerald-500/25",
    icon: "✓",
    title: "text-emerald-300",
  },
  warning: {
    border: "border-amber-500/25",
    icon: "⚠",
    title: "text-amber-200",
  },
  info: {
    border: "border-[var(--accent)]/25",
    icon: "ℹ",
    title: "text-[var(--foreground)]",
  },
  error: {
    border: "border-rose-500/25",
    icon: "✕",
    title: "text-rose-300",
  },
  achievement: {
    border: "border-[var(--accent)]/30",
    icon: "★",
    title: "text-[var(--accent-light)]",
  },
};

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] z-[10100] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-[calc(1.5rem+env(safe-area-inset-top))]"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast, index) => {
        const type = toast.type ?? "info";
        const styles = toastStyles[type];

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "toast-enter pointer-events-auto rounded-2xl border bg-[var(--surface)]/95 px-4 py-3.5 shadow-2xl backdrop-blur-xl",
              styles.border,
            )}
            style={{ zIndex: 100 + index }}
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-hover)] text-xs"
                aria-hidden
              >
                {styles.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", styles.title)}>
                  {toast.title}
                </p>
                {toast.subtitle && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {toast.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
