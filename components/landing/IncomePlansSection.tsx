"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import {
  ScrollReveal,
  SectionHeading,
  landingCardStaticClassName,
  landingSectionClassName,
} from "./shared";

const PAYCHECK_AMOUNT = 1000;

const ALLOCATIONS = [
  { label: "House", amount: 250, icon: "🏠" },
  { label: "Vacation", amount: 100, icon: "✈️" },
  { label: "Bills", amount: 300, icon: "📋" },
  { label: "Investments", amount: 100, icon: "📈" },
  { label: "Spending", amount: 250, icon: "💳" },
] as const;

export function IncomePlansSection() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [remaining, setRemaining] = useState(PAYCHECK_AMOUNT);

  useEffect(() => {
    let cancelled = false;
    let loopTimeout: number | undefined;

    function runCycle() {
      if (cancelled) return;

      setVisibleCount(0);
      setRemaining(PAYCHECK_AMOUNT);

      ALLOCATIONS.forEach((allocation, index) => {
        window.setTimeout(() => {
          if (cancelled) return;
          setVisibleCount(index + 1);
          setRemaining(
            PAYCHECK_AMOUNT -
              ALLOCATIONS.slice(0, index + 1).reduce((sum, item) => sum + item.amount, 0),
          );
        }, 600 + index * 700);
      });

      loopTimeout = window.setTimeout(runCycle, 5200);
    }

    runCycle();

    return () => {
      cancelled = true;
      if (loopTimeout) window.clearTimeout(loopTimeout);
    };
  }, []);

  return (
    <section id="income-plans" className={landingSectionClassName}>
      <ScrollReveal>
        <SectionHeading
          eyebrow="Income Plans"
          title="Every paycheck has a purpose."
          description="Assign every dollar before it lands. Buxme walks each deposit through your plan — savings, bills, investments, and spending — so nothing is left unaccounted for."
        />
      </ScrollReveal>

      <ScrollReveal delay={120}>
        <div className="mx-auto mt-14 max-w-md">
          <div className={cn(landingCardStaticClassName, "overflow-hidden p-6 sm:p-8")}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-full rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-6 py-5 text-center transition-all duration-500",
                  remaining < PAYCHECK_AMOUNT && "border-[var(--accent)]/40 shadow-[0_0_32px_rgba(0,119,237,0.12)]",
                )}
              >
                <span className="text-2xl">💵</span>
                <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">Paycheck</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
                  ${PAYCHECK_AMOUNT.toLocaleString()}
                </p>
                <p className="mt-3 text-xs font-medium tracking-wide text-[var(--accent-light)] uppercase">
                  Remaining
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums transition-all duration-500",
                    remaining === 0 ? "text-emerald-400" : "text-[var(--foreground)]",
                  )}
                >
                  ${remaining.toLocaleString()}
                </p>
              </div>

              <div className="my-2 flex flex-col items-center gap-1">
                {ALLOCATIONS.map((item, index) => (
                  <div key={item.label} className="flex flex-col items-center">
                    <span
                      className={cn(
                        "text-[var(--accent-light)] transition-opacity duration-300",
                        index < visibleCount ? "opacity-100" : "opacity-20",
                      )}
                      aria-hidden
                    >
                      ↓
                    </span>
                    <div
                      className={cn(
                        "mt-1 flex w-full min-w-[280px] items-center justify-between rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 transition-all duration-500",
                        index < visibleCount
                          ? "translate-y-0 opacity-100"
                          : "translate-y-2 opacity-0",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                        ${item.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
