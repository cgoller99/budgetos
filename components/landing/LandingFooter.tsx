import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Product", href: "#product" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.04] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm">
              💰
            </span>
            <span className="text-sm font-semibold text-white">Buxme</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/35">
            Your premium personal finance command center.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-white/40 transition-colors hover:text-white/70"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            Register
          </Link>
        </nav>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-white/[0.04] pt-8">
        <p className="text-sm text-white/28">
          © {year} Buxme. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
