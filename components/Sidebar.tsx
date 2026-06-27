import Link from "next/link";
import { NAV_ROUTES } from "@/lib/navigation";

type SidebarProps = {
  className?: string;
  activeHref?: string;
};

export function Sidebar({ className = "", activeHref = "/dashboard" }: SidebarProps) {
  return (
    <aside
      className={`flex w-60 shrink-0 flex-col border-r border-white/[0.04] bg-[#07090d] px-5 py-8 ${className}`}
    >
      <div className="mb-10 px-2">
        <Link href="/dashboard" className="block">
          <p className="text-xl font-semibold tracking-tight text-white">
            BudgetOS
          </p>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={`min-h-11 rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors ${
              route.href === activeHref
                ? "bg-white/[0.06] text-white"
                : "text-white/45 hover:bg-white/[0.03] hover:text-white/80"
            }`}
          >
            {route.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
