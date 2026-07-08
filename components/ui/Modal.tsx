"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { panelTitleClassName } from "./tokens";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      document.body.style.overflow = "hidden";

      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsAnimating(true));
      });

      return () => window.cancelAnimationFrame(frame);
    }

    setIsAnimating(false);
    document.body.style.overflow = "";

    const timeout = window.setTimeout(() => setIsMounted(false), 300);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isMounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm",
          isAnimating ? "modal-backdrop-enter" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative flex max-h-[min(90dvh,calc(100vh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-2xl sm:rounded-3xl",
          isAnimating ? "modal-panel-enter" : "translate-y-3 scale-[0.97] opacity-0",
        )}
      >
        <div className="overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-8">
          <h2 id="modal-title" className={panelTitleClassName}>
            {title}
          </h2>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
