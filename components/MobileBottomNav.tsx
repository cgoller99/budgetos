"use client";

import Link from "next/link";
import { useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import { sidebarActiveClassName, sidebarInactiveClassName } from "@/components/ui/tokens";
import {
  MOBILE_PRIMARY_NAV,
  isMobileMoreRoute,
} from "@/lib/mobile/navigation";
import { MobileMoreSheet } from "@/components/navigation/MobileMoreSheet";

export function MobileBottomNav({ activeHref }: { activeHref: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const path = activeHref.split("?")[0] ?? activeHref;
  const isMoreActive = isMobileMoreRoute(activeHref);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--surface-border)] bg-[var(--background)]/98 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden"
        aria-label="Primary navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
          {MOBILE_PRIMARY_NAV.map((route) => {
            const isActive = route.href === path;

            return (
              <Link
                key={route.href}
                href={route.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-ring flex min-h-12 min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-1.5 text-[10px] font-medium transition-colors duration-200 ease-out",
                  isActive ? sidebarActiveClassName : sidebarInactiveClassName,
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
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
            onClick={() => setMoreOpen(true)}
            className={cn(
              "focus-ring flex min-h-12 min-w-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-1.5 text-[10px] font-medium transition-colors duration-200 ease-out",
              isMoreActive ? sidebarActiveClassName : sidebarInactiveClassName,
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
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
