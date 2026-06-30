import Link from "next/link";
import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LEGAL_LAST_UPDATED } from "@/lib/legal/constants";

type LegalPageLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalPageLayout({
  title,
  description,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="app-shell min-h-screen font-sans text-[var(--foreground)]">
      <header className="border-b border-[var(--surface-border)] px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-base">
              💰
            </span>
            <span className="text-sm font-semibold">Buxme</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-[#0077ed] transition-colors hover:underline"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="px-6 py-12 sm:py-16">
        <article className="mx-auto max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wide text-[#0077ed]">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-10 text-[var(--text-secondary)]">
            {children}
          </div>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="mt-4 space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}
