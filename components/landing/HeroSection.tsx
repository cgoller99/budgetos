import { PrimaryLink, SecondaryLink } from "./shared";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pb-28 sm:pt-24 lg:pt-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(0,119,237,0.18),transparent)]"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <p className="onboarding-title-enter text-sm font-medium tracking-wide text-[#4da3ff] uppercase">
          Personal finance, refined
        </p>

        <h1 className="onboarding-subtitle-enter mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
          Your complete financial
          <span className="block text-white/90">command center</span>
        </h1>

        <p className="onboarding-options-enter mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/45 sm:text-lg">
          Track accounts, cash flow, bills, goals, and debt in one calm,
          beautifully designed workspace. Built for clarity — not clutter.
        </p>

        <div className="onboarding-options-enter mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryLink href="/register">Start for free</PrimaryLink>
          <SecondaryLink href="/login">Log in</SecondaryLink>
        </div>

        <p className="mt-5 text-sm text-white/30">
          No credit card required · Free to get started
        </p>
      </div>
    </section>
  );
}
