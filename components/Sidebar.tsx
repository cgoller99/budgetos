import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/components/ui/cn";
import {
  sidebarActiveClassName,
  sidebarInactiveClassName,
} from "@/components/ui/tokens";
import { NAV_ROUTES } from "@/lib/navigation";

type SidebarProps = {
  className?: string;
  activeHref?: string;
};

export function Sidebar({ className = "", activeHref = "/dashboard" }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-r border-[var(--surface-border)] bg-[var(--sidebar-bg)] px-4 py-8",
        className,
      )}
    >
      <div className="mb-10 px-3">
        <Link href="/dashboard" className="group block">
          <p className="text-xl font-semibold tracking-tight text-[var(--foreground)] transition-colors group-hover:text-[#4da3ff]">
            Buxme
          </p>
          <p className="mt-1 text-xs font-medium tracking-wide text-[var(--text-subtle)]">
            Personal finance
          </p>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5" aria-label="Main">
        {NAV_ROUTES.map((route, index) => {
          const isActive = route.href === activeHref;

          return (
            <Link
              key={route.href}
              href={route.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "sidebar-item-enter focus-ring flex min-h-11 items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-medium transition-all duration-200 ease-out",
                isActive ? sidebarActiveClassName : sidebarInactiveClassName,
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-[#0077ed]/20 text-[#4da3ff]"
                    : "bg-[var(--surface-subtle)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]",
                )}
              >
                <NavIcon name={route.icon} />
              </span>
              {route.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
