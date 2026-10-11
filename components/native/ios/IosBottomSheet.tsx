"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/ui/bodyScrollLock";

type IosBottomSheetProps = {
  open: boolean;
  title?: string;
  labelledBy?: string;
  onClose: () => void;
  children: ReactNode;
};

export function IosBottomSheet({
  open,
  title,
  labelledBy = "ios-sheet-title",
  onClose,
  children,
}: IosBottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOrigin = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const [retained, setRetained] = useState<ReactNode>(children);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) setRetained(children);
  }, [open, children]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setAnimating(true));
      });
      lockBodyScroll();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onCloseRef.current();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.cancelAnimationFrame(frame);
        unlockBodyScroll();
        window.removeEventListener("keydown", onKeyDown);
      };
    }

    setAnimating(false);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => setVisible(false), reduceMotion ? 0 : 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  function setDrag(next: number) {
    dragOffsetRef.current = next;
    setDragOffset(next);
  }

  function endDrag() {
    const shouldClose = dragOffsetRef.current > 96;
    dragOrigin.current = null;
    setDrag(0);
    if (shouldClose) onCloseRef.current();
  }

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close"
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onCloseRef.current()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelledBy : undefined}
        aria-label={title ? undefined : "Details"}
        className={cn(
          "native-sheet native-keyboard-avoid absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[22px] border border-white/[0.08] border-b-0 bg-[#0b0f14] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 transition-transform duration-200 ease-out",
          animating ? "translate-y-0" : "translate-y-full",
        )}
        style={
          dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)`, transition: "none" }
            : undefined
        }
      >
        <div
          className="mx-auto mb-2 flex h-7 w-full touch-none items-center justify-center"
          data-sheet-handle="true"
          onPointerDown={(event) => {
            dragOrigin.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragOrigin.current == null) return;
            setDrag(Math.max(0, event.clientY - dragOrigin.current));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        {title ? (
          <h2
            id={labelledBy}
            className="mb-3 text-center text-[17px] font-semibold text-[var(--foreground)]"
          >
            {title}
          </h2>
        ) : null}
        {open ? children : retained}
      </div>
    </div>,
    document.body,
  );
}
