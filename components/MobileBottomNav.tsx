"use client";

import Link from "next/link";
import { useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { MobileMoreSheet } from "@/components/navigation/MobileMoreSheet";
import { cn } from "@/components/ui/cn";
import {
  sidebarActiveClassName,
  sidebarInactiveClassName,
} from "@/components/ui/tokens";
import {
  IOS_PRIMARY_NAV,
  MOBILE_PRIMARY_NAV,
  isIosMoreRoute,
  isMobileMoreRoute,
} from "@/lib/mobile/navigation";
import { triggerHaptic } from "@/lib/native/haptics";
import { useNativeIos } from "@/lib/native/useNativeIos";

export function MobileBottomNav({ activeHref }: { activeHref: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const path = activeHref.split("?")[0] ?? activeHref;
  const nativeIos = useNativeIos();
  const primaryNav = nativeIos ? IOS_PRIMARY_NAV : MOBILE_PRIMARY_NAV;
  const isMoreActive = nativeIos
    ? isIosMoreRoute(activeHref)
    : isMobileMoreRoute(activeHref);

  return (
    <>
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-[var(--surface-border)] bg-[var(--background)]/98 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden",
          nativeIos && "native-tab-bar",
        )}
        aria-label="Primary navigation"
        data-native-tab-bar={nativeIos ? "ios" : "web"}
      >
        <div
          className={cn(
            "mx-auto flex max-w-lg items-stretch justify-between gap-1",
            nativeIos && "max-w-none gap-0",
          )}
        >
          {primaryNav.map((route) => {
            const isActive = route.href === path;

            return (
              <Link
                key={route.href}
                href={route.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  void triggerHaptic("selection");
                }}
                className={cn(
                  "focus-ring flex min-h-11 min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-1 text-[10px] font-medium transition-colors duration-200 ease-out",
                  nativeIos && "rounded-none gap-1 py-1.5 text-[11px] font-semibold tracking-tight",
                  isActive ? sidebarActiveClassName : sidebarInactiveClassName,
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
                    nativeIos && "size-7 rounded-md",
                    isActive
                      ? "bg-[var(--accent-muted)] text-[var(--accent-light)]"
                      : "text-[var(--text-muted)]",
                  )}
                  aria-hidden
                >
                  <NavIcon name={route.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate">{route.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-current={isMoreActive ? "page" : undefined}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            onClick={() => {
              void triggerHaptic("selection");
              setMoreOpen(true);
            }}
            className={cn(
              "focus-ring flex min-h-11 min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 py-1 text-[10px] font-medium transition-colors duration-200 ease-out",
              nativeIos && "rounded-none gap-1 py-1.5 text-[11px] font-semibold tracking-tight",
              isMoreActive ? sidebarActiveClassName : sidebarInactiveClassName,
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
                nativeIos && "size-7 rounded-md text-lg leading-none",
                isMoreActive
                  ? "bg-[var(--accent-muted)] text-[var(--accent-light)]"
                  : "text-[var(--text-muted)]",
              )}
              aria-hidden
            >
              ⋯
            </span>
            <span className="truncate">More</span>
          </button>
        </div>
      </nav>

      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        activeHref={activeHref}
      />
    </>
  );
}
