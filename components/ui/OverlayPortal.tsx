"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";

type OverlayPortalProps = {
  children: ReactNode;
};

/**
 * Renders above all app UI. Modals (z-modal) and toasts (z-toast) sit above this layer.
 */
export function OverlayPortal({ children }: OverlayPortalProps) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 isolate"
      style={{ zIndex: "var(--z-notification)" }}
      data-overlay-portal
    >
      {children}
    </div>,
    document.body,
  );
}
