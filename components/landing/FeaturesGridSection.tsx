import { cn } from "@/components/ui/cn";
import {
  ScrollReveal,
  SectionHeading,
  landingCardClassName,
  landingSectionClassName,
} from "./shared";

const FEATURES = [
  {
    title: "Bank Sync",
    description: "Connect accounts securely and keep balances and transactions in sync.",
    icon: "🏦",
  },
  {
    title: "Income Plans",
    description: "Allocate every paycheck to savings, bills, and spending automatically.",
    icon: "↔",
  },
  {
    title: "Goals",
    description: "Set targets, track milestones, and visualize progress over time.",
    icon: "★",
  },
  {
    title: "Bills",
    description: "Track due dates, split payments, and never miss an obligation.",
    icon: "▦",
  },
  {
    title: "Investments",
    description: "Track stocks, crypto, and retirement alongside the rest of your finances.",
    icon: "▲",
  },
  {
    title: "Calendar",
    description: "See bills, paychecks, and cash flow on a unified monthly calendar.",
    icon: "📅",
  },
  {
    title: "Household",
    description: "Invite a partner to collaborate on shared accounts, bills, and goals.",
    icon: "👥",
  },
  {
    title: "Financial Health",
    description: "A clear 0–100 score with reasons — savings rate, debt, and more.",
    icon: "♥",
  },
  {
    title: "Net Worth",
    description: "Assets minus liabilities, updated as you record activity across accounts.",
    icon: "◎",
  },
  {
    title: "Reports",
    description: "Monthly summaries, category breakdowns, and export when you need them.",
    icon: "▤",
  },
] as const;

export function FeaturesGridSection() {
  return (
    <section id="features" className={landingSectionClassName}>
      <ScrollReveal>
        <SectionHeading
          eyebrow="Features"
          title="Everything you need. Nothing you don't."
          description="Purpose-built tools for managing your money — without the noise of bloated finance apps."
        />
      </ScrollReveal>

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map((feature, index) => (
          <ScrollReveal key={feature.title} delay={index * 50}>
            <div
              className={cn(
                landingCardClassName,
                "group p-7 sm:p-8",
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#0077ed]/20 bg-[#0077ed]/10 text-base text-[#4da3ff] transition-transform duration-300 group-hover:scale-110">
                {feature.icon}
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {feature.description}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
