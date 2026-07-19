import Link from "next/link";
import { PrimaryLink, SecondaryLink } from "./shared";

const NAV_LINKS = [
  { label: "Why Buxme", href: "#why" },
  { label: "Features", href: "#features" },
  { label: "Income Plans", href: "#income-plans" },
  { label: "Product", href: "#showcase" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--surface-border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:h-[4.5rem]">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] text-lg">
            💰
          </span>
          <span className="text-base font-semibold tracking-tight text-[var(--foreground)]">
            Buxme
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--foreground)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SecondaryLink
            href="/login"
            className="hidden min-h-10 px-4 py-2 text-sm sm:inline-flex"
          >
            Log in
          </SecondaryLink>
          <PrimaryLink href="/register" className="min-h-10 px-4 py-2 text-sm">
            Get Started Free
          </PrimaryLink>
        </div>
      </div>
    </header>
  );
}
