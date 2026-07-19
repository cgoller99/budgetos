import { ScrollReveal, landingSectionClassName } from "./shared";

const METRICS = [
  { value: "Paycheck-first", label: "Budgeting by income cycle" },
  { value: "All-in-one", label: "Accounts, bills, goals, debt" },
  { value: "Optional sync", label: "Plaid or manual tracking" },
  { value: "Private by default", label: "Your data stays yours" },
] as const;

export function SocialProofSection() {
  return (
    <section className={landingSectionClassName}>
      <ScrollReveal>
        <p className="text-center text-sm font-medium text-[var(--text-muted)]">
          Built for people who want clarity without spreadsheet chaos
        </p>
      </ScrollReveal>

      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
        {METRICS.map((metric, index) => (
          <ScrollReveal key={metric.label} delay={index * 80} className="text-center">
            <p className="text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">
              {metric.value}
            </p>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">{metric.label}</p>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
