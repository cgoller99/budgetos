import Link from "next/link";
import type { ReactNode } from "react";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { cn } from "@/components/ui/cn";
import { sidebarActiveClassName, sidebarInactiveClassName } from "@/components/ui/tokens";
import { NAV_ROUTES } from "@/lib/navigation";

type TopBarProps = {
  activeHref?: string;
  title?: string;
  notificationCenter?: ReactNode;
};

export function TopBar({
  activeHref = "/dashboard",
  title = "Dashboard",
  notificationCenter,
}: TopBarProps) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-white/[0.04] bg-[#090b10]/40 px-6 py-6 backdrop-blur-sm lg:px-10 lg:py-7">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <div className="flex items-center gap-3 sm:gap-4">
          <GlobalSearch />
          {notificationCenter}
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-white/[0.04] px-6 py-4 lg:hidden">
        {NAV_ROUTES.map((route) => {
          const isActive = route.href === activeHref;

          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                isActive ? sidebarActiveClassName : sidebarInactiveClassName,
              )}
            >
              {route.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
