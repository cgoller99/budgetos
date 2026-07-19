import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import {
  sidebarActiveClassName,
  sidebarInactiveClassName,
} from "@/components/ui/tokens";
import { NAV_MORE_ROUTES, NAV_ROUTES } from "@/lib/navigation";

type SidebarProps = {
  className?: string;
  activeHref?: string;
};

export function Sidebar({ className = "", activeHref = "/dashboard" }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-60 shrink-0 flex-col border-r border-[var(--surface-border)] bg-[var(--sidebar-bg)] px-3 py-6",
        className,
      )}
    >
      <div className="mb-8 px-2">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--accent)] text-sm font-bold text-white">
            B
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight text-[var(--foreground)]">
              Buxme
            </p>
            <p className="text-[10px] font-medium text-[var(--text-muted)]">
              Finance OS
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {NAV_ROUTES.map((route, index) => {
          const isActive = route.href === activeHref;

          return (
            <Link
              key={route.href}
              href={route.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "sidebar-item-enter focus-ring flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                isActive ? sidebarActiveClassName : sidebarInactiveClassName,
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent-light)]"
                    : "text-[var(--text-muted)]",
                )}
              >
                <NavIcon name={route.icon} className="h-4 w-4" />
              </span>
              {route.label}
            </Link>
          );
        })}
        <div className="my-3 border-t border-[var(--surface-border)]" />
        {NAV_MORE_ROUTES.map((route) => {
          const isActive = route.href === activeHref;

          return (
            <Link
              key={route.href}
              href={route.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "focus-ring flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                isActive ? sidebarActiveClassName : sidebarInactiveClassName,
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)]">
                <NavIcon name={route.icon} className="h-4 w-4" />
              </span>
              {route.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
