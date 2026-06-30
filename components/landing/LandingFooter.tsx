import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Income Plans", href: "#income-plans" },
  { label: "Product", href: "#showcase" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Security", href: "/security" },
] as const;

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--surface-border)] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface-soft)] text-sm">
              💰
            </span>
            <span className="text-sm font-semibold text-[var(--foreground)]">Buxme</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--text-muted)]">
            Your premium personal finance command center.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {PRODUCT_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
            >
              {link.label}
            </a>
          ))}
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:support@buxme.com"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Support
          </a>
          <a
            href="mailto:support@buxme.com"
            className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Contact
          </a>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-[var(--surface-border)] pt-8">
        <p className="text-sm text-[var(--text-subtle)]">
          © {year} Buxme. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
