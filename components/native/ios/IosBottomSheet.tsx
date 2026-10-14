"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { triggerHaptic } from "@/lib/native/haptics";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/ui/bodyScrollLock";

type IosBottomSheetProps = {
  open: boolean;
  title?: string;
  labelledBy?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function IosBottomSheet({
  open,
  title,
  labelledBy = "ios-sheet-title",
  onClose,
  children,
  footer,
}: IosBottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOrigin = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const lastPointer = useRef<{ y: number; time: number } | null>(null);
  const velocityRef = useRef(0);
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

  function beginDrag(clientY: number) {
    dragOrigin.current = clientY;
    lastPointer.current = { y: clientY, time: performance.now() };
    velocityRef.current = 0;
  }

  function moveDrag(clientY: number) {
    if (dragOrigin.current == null) return;
    const now = performance.now();
    const previous = lastPointer.current;
    if (previous) {
      const elapsed = Math.max(now - previous.time, 1);
      velocityRef.current = (clientY - previous.y) / elapsed;
    }
    lastPointer.current = { y: clientY, time: now };
    setDrag(Math.max(0, clientY - dragOrigin.current));
  }

  function endDrag() {
    const shouldClose = dragOffsetRef.current > 96 || velocityRef.current > 0.65;
    dragOrigin.current = null;
    lastPointer.current = null;
    velocityRef.current = 0;
    setDrag(0);
    if (shouldClose) {
      void triggerHaptic("light");
      onCloseRef.current();
    }
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
            beginDrag(event.clientY);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            moveDrag(event.clientY);
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        {title ? (
          <h2
            id={labelledBy}
            className="mb-3 touch-none text-center text-[17px] font-semibold text-[var(--foreground)]"
            onPointerDown={(event) => {
              beginDrag(event.clientY);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              moveDrag(event.clientY);
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {title}
          </h2>
        ) : null}
        {open ? children : retained}
        {footer ? (
          <div className="native-sheet-footer sticky bottom-0 -mx-4 mt-4 border-t border-white/[0.06] bg-[#0b0f14] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
