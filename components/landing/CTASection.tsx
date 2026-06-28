import { PrimaryLink, SecondaryLink } from "./shared";

export function CTASection() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[1.75rem] border border-[#0077ed]/15 bg-gradient-to-b from-[#0077ed]/10 to-transparent px-8 py-14 text-center sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_100%,rgba(0,119,237,0.15),transparent)]"
        />

        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to take control?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/45">
            Join Buxme and bring your accounts, bills, and goals into one
            calm, focused workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryLink href="/register">Get Started</PrimaryLink>
            <SecondaryLink href="/login">Log in</SecondaryLink>
          </div>
        </div>
      </div>
    </section>
  );
}
