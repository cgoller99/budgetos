import { ScrollReveal, landingSectionClassName } from "./shared";

const METRICS = [
  { value: "2,400+", label: "Beta users" },
  { value: "18K+", label: "Transactions tracked" },
  { value: "4.9★", label: "Early feedback" },
  { value: "100%", label: "Manual control" },
] as const;

export function SocialProofSection() {
  return (
    <section className={landingSectionClassName}>
      <ScrollReveal>
        <p className="text-center text-sm font-medium text-[var(--text-muted)]">
          Trusted by our growing beta community
        </p>
      </ScrollReveal>

      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
        {METRICS.map((metric, index) => (
          <ScrollReveal key={metric.label} delay={index * 80} className="text-center">
            <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {metric.value}
            </p>
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">{metric.label}</p>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
