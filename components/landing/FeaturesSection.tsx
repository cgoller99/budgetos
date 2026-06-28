import { cardBaseClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { SectionHeading } from "./shared";

const FEATURES = [
  {
    title: "Unified dashboard",
    description:
      "See net worth, cash flow, and upcoming obligations at a glance — updated as you record activity.",
    icon: "◫",
  },
  {
    title: "Income & bills",
    description:
      "Track salary, freelance earnings, and recurring expenses with due dates and autopay status.",
    icon: "↔",
  },
  {
    title: "Bill calendar",
    description:
      "View upcoming payments in a monthly calendar with paid, due soon, and overdue states.",
    icon: "▦",
  },
  {
    title: "Transactions",
    description:
      "Record income, expenses, and transfers. Every change flows through to your dashboard instantly.",
    icon: "≡",
  },
  {
    title: "Savings & roadmap",
    description:
      "Set goals, track milestones, and visualize your full financial timeline from today forward.",
    icon: "◎",
  },
  {
    title: "Reports",
    description:
      "Generate monthly summaries and category breakdowns for smarter, data-driven decisions.",
    icon: "▤",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-20 sm:py-28">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to stay in control"
        description="Purpose-built tools for managing your money — without the noise of bloated finance apps."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className={cn(
              cardBaseClassName,
              "p-7 sm:p-8",
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#0077ed]/20 bg-[#0077ed]/10 text-base text-[#4da3ff]">
              {feature.icon}
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
