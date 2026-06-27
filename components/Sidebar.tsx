export const NAV_ITEMS = [
  "Dashboard",
  "Accounts",
  "Income",
  "Bills",
  "Savings",
  "Debt",
  "Reports",
  "Settings",
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

type SidebarProps = {
  className?: string;
  activeItem?: NavItem;
};

export function Sidebar({ className = "", activeItem = "Dashboard" }: SidebarProps) {
  return (
    <aside
      className={`flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#080d18] px-4 py-6 ${className}`}
    >
      <div className="mb-8 px-3">
        <p className="text-lg font-semibold tracking-tight text-white">
          BudgetOS
        </p>
        <p className="mt-0.5 text-xs text-white/40">Finance OS</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <a
            key={item}
            href="#"
            className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              item === activeItem
                ? "bg-white/[0.08] text-white"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
            }`}
          >
            {item}
          </a>
        ))}
      </nav>
    </aside>
  );
}
