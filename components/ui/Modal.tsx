"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/ui/bodyScrollLock";
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
      lockBodyScroll();

      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsAnimating(true));
      });

      return () => {
        window.cancelAnimationFrame(frame);
        unlockBodyScroll();
      };
    }

    setIsAnimating(false);
    unlockBodyScroll();

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

  if (!isMounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/45",
          isAnimating ? "modal-backdrop-enter" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border border-[var(--surface-border)] bg-[var(--surface)] shadow-2xl sm:h-auto sm:max-h-[min(90dvh,calc(100vh-2rem))] sm:max-w-md sm:rounded-3xl",
          isAnimating ? "modal-panel-enter" : "translate-y-3 scale-[0.97] opacity-0",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id="modal-title" className={panelTitleClassName}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring min-h-11 min-w-11 rounded-xl text-sm text-white/50 hover:text-white sm:hidden"
              aria-label="Close"
            >
              Close
            </button>
          </div>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
