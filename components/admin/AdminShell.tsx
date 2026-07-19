"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/components/ui/cn";
import { scheduleAdminHashScroll } from "@/components/admin/adminHashScroll";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin#revenue", label: "Revenue" },
  { href: "/admin#users", label: "Users" },
  { href: "/admin#feedback", label: "Feedback" },
  { href: "/admin#analytics", label: "Analytics" },
  { href: "/admin#health", label: "System" },
  { href: "/admin#logs", label: "Logs" },
  { href: "/admin#beta", label: "Beta" },
  { href: "/admin#releases", label: "Releases" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    scheduleAdminHashScroll();

    const onHashChange = () => scheduleAdminHashScroll();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  return (
    <div className="app-shell min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-sm">
              ⚙️
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Buxme Admin</p>
              <p className="text-xs text-[var(--text-muted)]">Platform operations dashboard</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Back to app
          </Link>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 pb-3">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors",
                pathname === "/admin"
                  ? "bg-[var(--accent)]/10 text-[var(--accent-light)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
