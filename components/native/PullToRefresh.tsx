"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { triggerHaptic } from "@/lib/native/haptics";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

type PullToRefreshProps = {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
};

const THRESHOLD = 72;

/**
 * Lightweight pull-to-refresh for Capacitor iOS data screens.
 * No-op on web.
 */
export function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
}: PullToRefreshProps) {
  const native = useNativeIos();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const runRefresh = useCallback(async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    void triggerHaptic("medium");

    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [onRefresh, refreshing]);

  useEffect(() => {
    if (!native || disabled) {
      return;
    }

    const el = containerRef.current;
    if (!el) {
      return;
    }

    function onTouchStart(event: TouchEvent) {
      if (refreshing) {
        return;
      }

      const scrollTop =
        document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
      if (scrollTop > 2) {
        startY.current = null;
        setIsDragging(false);
        return;
      }

      startY.current = event.touches[0]?.clientY ?? null;
      setIsDragging(true);
    }

    function onTouchMove(event: TouchEvent) {
      if (startY.current === null || refreshing) {
        return;
      }

      const currentY = event.touches[0]?.clientY ?? startY.current;
      const delta = Math.max(0, currentY - startY.current);
      if (delta > 8) {
        setPull(Math.min(delta * 0.55, THRESHOLD + 28));
      }
    }

    function onTouchEnd() {
      if (startY.current === null) {
        return;
      }

      const shouldRefresh = pull >= THRESHOLD;
      startY.current = null;
      setIsDragging(false);

      if (shouldRefresh) {
        void runRefresh();
      } else {
        setPull(0);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, native, pull, refreshing, runRefresh]);

  if (!native) {
    return <>{children}</>;
  }

  const indicatorVisible = pull > 12 || refreshing;

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center transition-opacity",
          indicatorVisible ? "opacity-100" : "opacity-0",
        )}
        style={{ transform: `translateY(${Math.max(pull - 28, 0)}px)` }}
        aria-hidden
      >
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
          <span
            className={cn(
              "block size-4 rounded-full border-2 border-[var(--accent)] border-t-transparent",
              refreshing || pull >= THRESHOLD ? "animate-spin" : "",
            )}
          />
        </div>
      </div>
      <div
        style={{
          transform: pull || refreshing ? `translateY(${refreshing ? 36 : pull * 0.35}px)` : undefined,
          transition: isDragging ? undefined : "transform 180ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
