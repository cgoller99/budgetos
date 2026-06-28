import { cardBaseClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { SectionHeading } from "./shared";

const SECURITY_POINTS = [
  {
    title: "Encrypted in transit",
    description:
      "All connections use TLS encryption. Your data travels securely between your browser and our servers.",
    icon: "🔒",
  },
  {
    title: "Secure authentication",
    description:
      "Industry-standard auth with email verification, password reset, and session management built in.",
    icon: "🛡",
  },
  {
    title: "Your data, your control",
    description:
      "You decide what to track and when. Export your data anytime — no lock-in, no surprises.",
    icon: "◉",
  },
  {
    title: "Privacy by design",
    description:
      "We don't sell your financial data. Buxme is built to help you — not to monetize your information.",
    icon: "◎",
  },
] as const;

export function SecuritySection() {
  return (
    <section id="security" className="px-6 py-20 sm:py-28">
      <SectionHeading
        eyebrow="Security"
        title="Built on trust"
        description="Your finances deserve the same care you'd expect from the tools you rely on every day."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:gap-5">
        {SECURITY_POINTS.map((point) => (
          <div
            key={point.title}
            className={cn(cardBaseClassName, "flex gap-5 p-7 sm:p-8")}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-lg">
              {point.icon}
            </span>
            <div>
              <h3 className="text-base font-semibold text-white">
                {point.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/40">
                {point.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
