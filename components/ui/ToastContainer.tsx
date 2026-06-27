"use client";

import type { ToastMessage } from "@/context/ToastContext";
import { Card } from "./Card";

type ToastContainerProps = {
  toasts: ToastMessage[];
};

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
      {toasts.map((toast) => (
        <Card
          key={toast.id}
          padding="none"
          role="status"
          aria-live="polite"
          className="toast-enter pointer-events-auto border-white/[0.08] bg-[#111827]/95 px-4 py-3.5 shadow-2xl"
        >
          <p className="text-sm font-medium text-white">{toast.title}</p>
          {toast.subtitle && (
            <p className="mt-1 text-sm text-white/55">{toast.subtitle}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
