"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import {
  sidebarActiveClassName,
  sidebarInactiveClassName,
} from "@/components/ui/tokens";
import { IOS_MORE_NAV, MOBILE_MORE_NAV } from "@/lib/mobile/navigation";
import { triggerHaptic } from "@/lib/native/haptics";
import { useNativeIos } from "@/lib/native/useNativeIos";

type MobileMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  activeHref: string;
};

export function MobileMoreSheet({
  open,
  onClose,
  activeHref,
}: MobileMoreSheetProps) {
  const pathname = usePathname();
  const nativeIos = useNativeIos();
  const routes = nativeIos ? IOS_MORE_NAV : MOBILE_MORE_NAV;
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setAnimating(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setAnimating(false);
    const timeout = window.setTimeout(() => setVisible(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  if (!visible) {
    return null;
  }

  function openFeedback() {
    void triggerHaptic("light");
    onClose();
    window.dispatchEvent(new CustomEvent("buxme:open-feedback"));
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          animating ? "opacity-100" : "opacity-0",
        )}
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[78vh] overflow-y-auto rounded-t-[22px] border border-[var(--surface-border)] bg-[var(--background)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 transition-transform duration-220 ease-out lg:hidden",
          nativeIos && "native-sheet",
          animating ? "translate-y-0" : "translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
          More
        </p>
        <div
          className={cn(
            "grid grid-cols-2 gap-2",
            nativeIos && "grid-cols-1 gap-1",
          )}
        >
          {routes.map((route) => {
            const hrefPath = route.href.split("#")[0]!;
            const isActive =
              activeHref === route.href ||
              pathname === hrefPath ||
              pathname.startsWith(`${hrefPath}/`);

            if ("action" in route && route.action === "feedback") {
              return (
                <button
                  key={route.label}
                  type="button"
                  onClick={openFeedback}
                  className={cn(
                    "focus-ring flex min-h-11 items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-colors",
                    nativeIos && "rounded-xl bg-[var(--surface-subtle)]",
                    sidebarInactiveClassName,
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)]">
                    <NavIcon name={route.icon} />
                  </span>
                  {route.label}
                </button>
              );
            }

            return (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => {
                  void triggerHaptic("selection");
                  onClose();
                }}
                className={cn(
                  "focus-ring flex min-h-11 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                  nativeIos && "rounded-xl",
                  isActive ? sidebarActiveClassName : sidebarInactiveClassName,
                  nativeIos && !isActive && "bg-[var(--surface-subtle)]",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)]">
                  <NavIcon name={route.icon} />
                </span>
                {route.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
