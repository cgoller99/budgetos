"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

type FloatingPanelOptions = {
  isOpen: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelWidth?: number;
  gap?: number;
  mobileBreakpoint?: number;
};

function getIsMobile(breakpoint: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth < breakpoint;
}

export function useFloatingPanelPosition({
  isOpen,
  triggerRef,
  panelWidth = 384,
  gap = 8,
  mobileBreakpoint = 1024,
}: FloatingPanelOptions): {
  isMobile: boolean;
  panelStyle: CSSProperties;
} {
  const [isMobile, setIsMobile] = useState(() => getIsMobile(mobileBreakpoint));
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    function update() {
      const mobile = getIsMobile(mobileBreakpoint);
      setIsMobile(mobile);

      if (!triggerRef.current) {
        setPanelStyle({});
        return;
      }

      const rect = triggerRef.current.getBoundingClientRect();

      if (mobile) {
        setPanelStyle({
          top: rect.bottom + gap,
          right: 12,
          width: "min(14rem, calc(100vw - 24px))",
        });
        return;
      }

      const width = Math.min(panelWidth, window.innerWidth - 24);
      const left = Math.max(
        12,
        Math.min(rect.right - width, window.innerWidth - width - 12),
      );
      const top = rect.bottom + gap;
      const maxHeight = Math.min(512, window.innerHeight - top - 16);

      setPanelStyle({
        top,
        left,
        width,
        maxHeight,
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [gap, isOpen, mobileBreakpoint, panelWidth, triggerRef]);

  return { isMobile, panelStyle };
}
