"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { sidebarActiveClassName, sidebarInactiveClassName } from "@/components/ui/tokens";
import { NAV_ROUTES } from "@/lib/navigation";

const MOBILE_NAV_ROUTES = NAV_ROUTES.filter((route) =>
  ["/dashboard", "/accounts", "/bills", "/income/plan", "/savings", "/settings"].includes(route.href),
);

export function MobileBottomNav({ activeHref }: { activeHref: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--surface-border)] bg-[var(--background)]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
        {MOBILE_NAV_ROUTES.map((route) => {
          const isActive = route.href === activeHref;

          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
                isActive ? sidebarActiveClassName : sidebarInactiveClassName,
              )}
            >
              <span className="truncate">{route.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
