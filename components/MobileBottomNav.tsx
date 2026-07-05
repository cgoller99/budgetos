"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileMoreSheet } from "@/components/navigation/MobileMoreSheet";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import { sidebarActiveClassName, sidebarInactiveClassName } from "@/components/ui/tokens";
import { NAV_ROUTES } from "@/lib/navigation";

const MOBILE_PRIMARY_HREFS = [
  "/dashboard",
  "/accounts",
  "/bills",
  "/income",
  "/savings",
] as const;

const MOBILE_MORE_HREFS = [
  "/calendar",
  "/transactions",
  "/debt",
  "/investments",
  "/reports",
  "/roadmap",
  "/settings",
];

export function MobileBottomNav({ activeHref }: { activeHref: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryRoutes = NAV_ROUTES.filter((route) =>
    MOBILE_PRIMARY_HREFS.includes(route.href as (typeof MOBILE_PRIMARY_HREFS)[number]),
  );
  const isMoreActive = MOBILE_MORE_HREFS.some(
    (href) => href === activeHref || activeHref.startsWith(`${href}?`),
  );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--surface-border)] bg-[var(--background)]/95 px-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Primary navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
          {primaryRoutes.map((route) => {
            const isActive = route.href === activeHref;

            return (
              <Link
                key={route.href}
                href={route.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-ring flex min-h-11 min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-all duration-200 ease-out",
                  isActive ? sidebarActiveClassName : sidebarInactiveClassName,
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-[#0077ed]/20 text-[#4da3ff]"
                      : "text-[var(--text-muted)]",
                  )}
                  aria-hidden
                >
                  <NavIcon name={route.icon} />
                </span>
                <span className="truncate">{route.label.split(" ")[0]}</span>
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
              "focus-ring flex min-h-11 min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-all duration-200 ease-out",
              isMoreActive ? sidebarActiveClassName : sidebarInactiveClassName,
            )}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-all duration-200",
                isMoreActive
                  ? "bg-[#0077ed]/20 text-[#4da3ff]"
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
