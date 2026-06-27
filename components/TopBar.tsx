import { NAV_ITEMS, type NavItem } from "./Sidebar";

type TopBarProps = {
  activeItem?: NavItem;
  eyebrow?: string;
  title?: string;
  date?: string;
};

export function TopBar({
  activeItem = "Dashboard",
  eyebrow = "Overview",
  title = "Dashboard",
  date = "June 2026",
}: TopBarProps) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 lg:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-white/35">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
        </div>
        <p className="hidden text-sm text-white/40 sm:block">{date}</p>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-5 py-3 lg:hidden">
        {NAV_ITEMS.map((item) => (
          <a
            key={item}
            href="#"
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              item === activeItem
                ? "bg-white/[0.1] text-white"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            {item}
          </a>
        ))}
      </nav>
    </>
  );
}
