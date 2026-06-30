import { cn } from "@/components/ui/cn";
import {
  ScrollReveal,
  SectionHeading,
  landingCardClassName,
  landingSectionClassName,
} from "./shared";

const REASONS = [
  {
    title: "Know where every paycheck goes.",
    description:
      "Income Plans split each deposit into savings, bills, and spending before you touch a dollar — so every paycheck has a purpose.",
    illustration: (
      <div className="relative flex h-28 w-full items-end justify-center gap-2 px-4">
        {[48, 72, 56, 88, 64].map((height, index) => (
          <div
            key={height}
            className={cn(
              "w-6 rounded-t-md bg-gradient-to-t from-[#0077ed]/20 to-[#0077ed]/60",
              index === 3 && "from-[#0077ed]/40 to-[#4da3ff]",
            )}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    ),
  },
  {
    title: "Manage every account in one place.",
    description:
      "Track checking, savings, credit, investments, and debt in a single calm dashboard — always up to date when you record activity.",
    illustration: (
      <div className="flex h-28 flex-col items-center justify-center gap-2 px-6">
        <div className="flex w-full items-center gap-2">
          <div className="h-8 flex-1 rounded-lg border border-[#0077ed]/30 bg-[#0077ed]/10" />
          <span className="text-lg text-[#4da3ff]">→</span>
          <div className="flex gap-1">
            {["$200", "$100", "Rest"].map((label) => (
              <div
                key={label}
                className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-2 py-1 text-[10px] text-[var(--text-muted)]"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--text-subtle)]">Paycheck → Purpose</p>
      </div>
    ),
  },
  {
    title: "Build wealth with confidence.",
    description:
      "Financial Health, Safe To Spend, and net worth tracking give you clear signals — not spreadsheets — so you can act with confidence.",
    illustration: (
      <div className="flex h-28 items-center justify-center gap-6">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="var(--surface-border)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#0077ed"
              strokeWidth="3"
              strokeDasharray="66 100"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-lg font-semibold text-[var(--foreground)]">82</span>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400/90">
            Safe to spend $1,840
          </div>
          <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            3 bills due this week
          </div>
        </div>
      </div>
    ),
  },
] as const;

export function WhyBuxmeSection() {
  return (
    <section id="why" className={landingSectionClassName}>
      <ScrollReveal>
        <SectionHeading
          eyebrow="Why Buxme"
          title="Finance software that respects your time"
          description="Built for people who want clarity without complexity — manual tracking with the polish of a premium SaaS product."
        />
      </ScrollReveal>

      <div className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-3">
        {REASONS.map((reason, index) => (
          <ScrollReveal key={reason.title} delay={index * 100}>
            <div className={cn(landingCardClassName, "flex h-full flex-col overflow-hidden p-0")}>
              <div className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)]">
                {reason.illustration}
              </div>
              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <h3 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
                  {reason.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {reason.description}
                </p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
