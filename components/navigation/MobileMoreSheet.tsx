"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import { sidebarActiveClassName, sidebarInactiveClassName } from "@/components/ui/tokens";
import { NAV_MORE_ROUTES, NAV_ROUTES, NAV_SECONDARY_ROUTES } from "@/lib/navigation";

const MOBILE_PRIMARY_HREFS = new Set([
  "/dashboard",
  "/accounts",
  "/bills",
  "/income",
  "/savings",
]);

const secondaryRoutes = [
  ...NAV_SECONDARY_ROUTES,
  ...NAV_ROUTES.filter((route) => !MOBILE_PRIMARY_HREFS.has(route.href)),
  ...NAV_MORE_ROUTES,
];

type MobileMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  activeHref: string;
};

export function MobileMoreSheet({ open, onClose, activeHref }: MobileMoreSheetProps) {
  const pathname = usePathname();

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl border border-[var(--surface-border)] bg-[var(--background)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 lg:hidden"
        role="dialog"
        aria-label="More navigation"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <p className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          More
        </p>
        <div className="grid grid-cols-2 gap-2">
          {secondaryRoutes.map((route) => {
            const isActive =
              activeHref === route.href || pathname === route.href;

            return (
              <Link
                key={route.href}
                href={route.href}
                onClick={onClose}
                className={cn(
                  "focus-ring flex min-h-12 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                  isActive ? sidebarActiveClassName : sidebarInactiveClassName,
                )}
              >
                <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--surface-subtle)]">
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
