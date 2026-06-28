import { cardBaseClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { PrimaryLink, SectionHeading } from "./shared";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to take control of your finances.",
    features: [
      "Unified dashboard",
      "Accounts & transactions",
      "Bills & income tracking",
      "Savings goals & roadmap",
      "Debt tracking",
      "Reports & exports",
    ],
    highlighted: true,
    comingSoon: false,
  },
  {
    name: "Pro",
    price: "—",
    period: "coming soon",
    description: "Advanced tools for households and power users.",
    features: [
      "Everything in Free",
      "Household collaboration",
      "Advanced reports",
      "Priority support",
      "Early access to new features",
    ],
    highlighted: false,
    comingSoon: true,
  },
] as const;

export function PricingSection() {
  return (
    <section id="pricing" className="px-6 py-20 sm:py-28">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple, transparent pricing"
        description="Start free today. Pro plans for households and advanced features are on the way."
      />

      <div className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              cardBaseClassName,
              "relative flex flex-col p-8",
              plan.highlighted &&
                "border-[#0077ed]/20 shadow-[0_16px_48px_rgba(0,119,237,0.12)]",
            )}
          >
            {plan.comingSoon && (
              <span className="absolute top-6 right-6 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/50">
                Coming soon
              </span>
            )}

            <p className="text-sm font-medium text-white/45">{plan.name}</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight text-white">
                {plan.price}
              </span>
              <span className="text-sm text-white/35">/ {plan.period}</span>
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
              {plan.highlighted ? (
                <PrimaryLink href="/register" className="w-full">
                  Get started free
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
