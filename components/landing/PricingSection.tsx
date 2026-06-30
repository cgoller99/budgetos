import { cardBaseClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { PLAN_DEFINITIONS } from "@/lib/subscription/plans";
import { PrimaryLink, SectionHeading } from "./shared";

const stripeEnabled =
  process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());

export function PricingSection() {
  return (
    <section id="pricing" className="px-6 py-20 sm:py-28">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple, transparent pricing"
        description="Start free. Upgrade to Pro or Pro+ when you need household collaboration or advanced reporting."
      />

      <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-3">
        {PLAN_DEFINITIONS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              cardBaseClassName,
              "relative flex flex-col p-8",
              plan.highlighted &&
                "border-[#0077ed]/20 shadow-[0_16px_48px_rgba(0,119,237,0.12)]",
            )}
          >
            <p className="text-sm font-medium text-white/45">{plan.name}</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight text-white">
                {plan.priceLabel}
              </span>
              <span className="text-sm text-white/35">/ {plan.periodLabel}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/40">
              {plan.description}
            </p>

            <ul className="mt-8 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-white/55"
                >
                  <span className="mt-0.5 text-[#0077ed]" aria-hidden>
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {plan.id === "free" ? (
                <PrimaryLink href="/register" className="w-full">
                  Get started free
                </PrimaryLink>
              ) : stripeEnabled ? (
                <PrimaryLink
                  href={`/login?redirect=${encodeURIComponent("/settings#billing")}&plan=${plan.id}`}
                  className="w-full"
                >
                  Subscribe to {plan.name}
                </PrimaryLink>
              ) : (
                <div className="flex min-h-12 items-center justify-center rounded-2xl border border-dashed border-white/[0.08] text-sm text-white/30">
                  Available soon
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
