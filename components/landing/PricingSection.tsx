"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { PLAN_DEFINITIONS } from "@/lib/subscription/plans";
import {
  PrimaryLink,
  ScrollReveal,
  SectionHeading,
  landingCardClassName,
  landingSectionClassName,
} from "./shared";

type BillingPeriod = "monthly" | "yearly";

const stripeEnabled =
  process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" &&
  Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());

const COMPARISON_ROWS = [
  { feature: "Unified dashboard", free: true, pro: true, proPlus: true },
  { feature: "Accounts & transactions", free: true, pro: true, proPlus: true },
  { feature: "Bills & income tracking", free: true, pro: true, proPlus: true },
  { feature: "Savings goals & roadmap", free: true, pro: true, proPlus: true },
  { feature: "Debt tracking", free: true, pro: true, proPlus: true },
  { feature: "Basic reports", free: true, pro: true, proPlus: true },
  { feature: "Household collaboration", free: false, pro: true, proPlus: true },
  { feature: "Shared finances", free: false, pro: true, proPlus: true },
  { feature: "Priority support", free: false, pro: true, proPlus: true },
  { feature: "Advanced reports", free: false, pro: false, proPlus: true },
  { feature: "Early access features", free: false, pro: false, proPlus: true },
  { feature: "Premium insights", free: false, pro: false, proPlus: true },
] as const;

function parseMonthlyPrice(priceLabel: string): number | null {
  const match = priceLabel.match(/\$([\d.]+)/);
  return match ? Number.parseFloat(match[1]) : null;
}

function formatPrice(amount: number): string {
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function getDisplayPrice(
  plan: (typeof PLAN_DEFINITIONS)[number],
  period: BillingPeriod,
): { price: string; periodLabel: string; savingsNote?: string } {
  if (plan.id === "free") {
    return { price: plan.priceLabel, periodLabel: plan.periodLabel };
  }

  const monthly = parseMonthlyPrice(plan.priceLabel);
  if (!monthly || period === "monthly") {
    return { price: plan.priceLabel, periodLabel: "month" };
  }

  const yearlyMonthly = monthly * 0.8;
  const yearlyTotal = yearlyMonthly * 12;

  return {
    price: formatPrice(yearlyMonthly),
    periodLabel: "month",
    savingsNote: `${formatPrice(yearlyTotal)} billed yearly · Save 20%`,
  };
}

function PlanCheck({ included }: { included: boolean }) {
  return (
    <span
      className={cn(
        "text-sm",
        included ? "text-[var(--accent)]" : "text-[var(--text-subtle)]",
      )}
      aria-hidden
    >
      {included ? "✓" : "—"}
    </span>
  );
}

export function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <section id="pricing" className={landingSectionClassName}>
      <ScrollReveal>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          description="Start free. Upgrade to Pro or Pro+ when you need household collaboration or advanced reporting."
        />
      </ScrollReveal>

      <ScrollReveal delay={80}>
        <div className="mx-auto mt-10 flex justify-center">
          <div className="inline-flex rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-1">
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                period === "monthly"
                  ? "bg-[var(--accent)] text-white shadow-[0_2px_12px_rgba(0,119,237,0.3)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPeriod("yearly")}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                period === "yearly"
                  ? "bg-[var(--accent)] text-white shadow-[0_2px_12px_rgba(0,119,237,0.3)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
              )}
            >
              Yearly
              <span className="ml-1.5 text-xs opacity-80">Save 20%</span>
            </button>
          </div>
        </div>
      </ScrollReveal>

      <div className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-3">
        {PLAN_DEFINITIONS.map((plan, index) => {
          const display = getDisplayPrice(plan, period);
          const isHighlighted = plan.highlighted;

          return (
            <ScrollReveal key={plan.id} delay={index * 80}>
              <div
                className={cn(
                  landingCardClassName,
                  "relative flex h-full flex-col p-8",
                  isHighlighted &&
                    "border-[var(--accent)]/25 shadow-[0_16px_48px_rgba(0,119,237,0.12)] ring-1 ring-[var(--accent)]/10",
                )}
              >
                {isHighlighted ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-0.5 text-xs font-medium text-[var(--accent-light)]">
                    Most popular
                  </span>
                ) : null}

                <p className="text-sm font-medium text-[var(--text-muted)]">{plan.name}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                    {display.price}
                  </span>
                  <span className="text-sm text-[var(--text-subtle)]">
                    / {display.periodLabel}
                  </span>
                </div>
                {display.savingsNote ? (
                  <p className="mt-1 text-xs text-[var(--accent-light)]/80">{display.savingsNote}</p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                  {plan.description}
                </p>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]"
                    >
                      <span className="mt-0.5 text-[var(--accent)]" aria-hidden>
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
                    <Link
                      href={`/login?redirect=${encodeURIComponent("/settings#billing")}&plan=${plan.id}`}
                      className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-dashed border-[var(--surface-border)] text-sm text-[var(--text-subtle)] transition-colors hover:border-[var(--surface-border-strong)] hover:text-[var(--text-muted)]"
                    >
                      Get started with {plan.name}
                    </Link>
                  )}
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      <ScrollReveal delay={120}>
        <div className="mx-auto mt-16 max-w-4xl overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--surface-border)]">
                <th className="pb-4 pr-4 font-medium text-[var(--text-muted)]">Compare plans</th>
                <th className="pb-4 px-4 text-center font-medium text-[var(--foreground)]">Free</th>
                <th className="pb-4 px-4 text-center font-medium text-[var(--accent-light)]">Pro</th>
                <th className="pb-4 pl-4 text-center font-medium text-[var(--foreground)]">Pro+</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-[var(--surface-border)] last:border-0"
                >
                  <td className="py-3.5 pr-4 text-[var(--text-secondary)]">{row.feature}</td>
                  <td className="py-3.5 px-4 text-center">
                    <PlanCheck included={row.free} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <PlanCheck included={row.pro} />
                  </td>
                  <td className="py-3.5 pl-4 text-center">
                    <PlanCheck included={row.proPlus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollReveal>
    </section>
  );
}
