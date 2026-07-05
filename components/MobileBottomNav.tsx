"use client";

import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import { sidebarActiveClassName, sidebarInactiveClassName } from "@/components/ui/tokens";
import { NAV_ROUTES } from "@/lib/navigation";

const MOBILE_NAV_ROUTES = NAV_ROUTES.filter((route) =>
  ["/dashboard", "/accounts", "/bills", "/income/plan", "/savings", "/settings"].includes(route.href),
);

export function MobileBottomNav({ activeHref }: { activeHref: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--surface-border)] bg-[var(--background)]/95 px-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
        {MOBILE_NAV_ROUTES.map((route) => {
          const isActive = route.href === activeHref;
          const shortLabel = route.label.split(" ")[0];

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
              <span className="truncate">{shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
