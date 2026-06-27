import Link from "next/link";
import type { ReactNode } from "react";
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
      <header className="flex items-center justify-between border-b border-white/[0.04] px-6 py-6 lg:px-10 lg:py-7">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <div className="flex items-center gap-4">{notificationCenter}</div>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-white/[0.04] px-6 py-4 lg:hidden">
        {NAV_ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
              route.href === activeHref
                ? "bg-white/[0.06] text-white"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            {route.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
