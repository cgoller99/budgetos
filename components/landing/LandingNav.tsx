import Link from "next/link";
import { PrimaryLink, SecondaryLink } from "./shared";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Product", href: "#product" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#090b10]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:h-[4.5rem]">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-lg">
            💰
          </span>
          <span className="text-base font-semibold tracking-tight text-white">
            BudgetOS
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/50 transition-colors duration-200 hover:text-white/85"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SecondaryLink href="/login" className="hidden min-h-10 px-4 py-2 text-sm sm:inline-flex">
            Log in
          </SecondaryLink>
          <PrimaryLink href="/register" className="min-h-10 px-4 py-2 text-sm">
            Get started
          </PrimaryLink>
        </div>
      </div>
    </header>
  );
}
