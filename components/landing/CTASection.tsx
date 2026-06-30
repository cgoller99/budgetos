import { PrimaryLink, ScrollReveal, landingSectionClassName } from "./shared";

export function CTASection() {
  return (
    <section className={landingSectionClassName}>
      <ScrollReveal>
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[1.75rem] border border-[#0077ed]/15 bg-gradient-to-b from-[#0077ed]/10 to-transparent px-8 py-14 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_100%,rgba(0,119,237,0.15),transparent)]"
          />

          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
              Ready to take control of your finances?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[var(--text-muted)]">
              Start using Buxme for free today.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryLink href="/register">Get Started Free</PrimaryLink>
            </div>
            <p className="mt-5 text-sm text-[var(--text-subtle)]">
              No credit card required · Set up in minutes
            </p>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
