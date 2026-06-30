import { DashboardPreview } from "./DashboardPreview";
import { PrimaryLink, SecondaryLink } from "./shared";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-12 sm:pb-24 sm:pt-20 lg:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(0,119,237,0.18),transparent)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <p className="landing-fade-in text-sm font-medium tracking-wide text-[#4da3ff] uppercase">
            Buxme
          </p>

          <h1 className="landing-fade-in landing-delay-1 mt-5 text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Take Control of Every Dollar.
          </h1>

          <p className="landing-fade-in landing-delay-2 mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg lg:mx-0">
            Buxme helps you manage your money, automate your finances, plan every
            paycheck, and build wealth—all in one place.
          </p>

          <div className="landing-fade-in landing-delay-3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <PrimaryLink href="/register">Get Started Free</PrimaryLink>
            <SecondaryLink href="/register">View Demo</SecondaryLink>
          </div>

          <p className="landing-fade-in landing-delay-4 mt-5 text-sm text-[var(--text-subtle)]">
            No credit card required · Free to get started
          </p>
        </div>

        <div className="landing-fade-in landing-delay-2">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
