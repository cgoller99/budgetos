"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import {
  ScrollReveal,
  SectionHeading,
  landingCardStaticClassName,
  landingSectionClassName,
} from "./shared";

const FAQ_ITEMS = [
  {
    question: "Is Buxme free?",
    answer:
      "Yes. Free includes the dashboard plus manual accounts, bills, income, goals, and debt tracking. Pro unlocks Plaid bank sync and automation. Pro+ adds advanced reports and premium insights.",
  },
  {
    question: "Can I connect my bank?",
    answer:
      "Yes on Pro and Pro+. Plaid bank connections sync balances and transactions automatically. Free accounts can track everything manually.",
  },
  {
    question: "How secure is Buxme?",
    answer:
      "Your account uses industry-standard authentication, encrypted connections, and secure cloud infrastructure. Bank credentials are never stored on our servers.",
  },
  {
    question: "Can couples use Buxme?",
    answer:
      "Yes. Pro and Pro+ include household collaboration — invite a partner to share accounts, bills, goals, and income plans in one workspace.",
  },
  {
    question: "What makes Buxme different?",
    answer:
      "Buxme is built around Income Plans — budgeting by paycheck, not month. Combined with Financial Health, Safe To Spend, and a unified dashboard, it gives you clarity without spreadsheet complexity.",
  },
  {
    question: "Do I need Plaid?",
    answer:
      "No. Free users can track manually. Automatic Plaid bank sync requires Pro or Pro+.",
  },
  {
    question: "Can I import spreadsheets?",
    answer:
      "Manual entry is supported today across accounts, transactions, and bills. Contact support@buxme.co if you need help migrating existing spreadsheet data.",
  },
] as const;

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className={landingSectionClassName}>
      <ScrollReveal>
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions"
          description="Everything you need to know before getting started."
        />
      </ScrollReveal>

      <div className="mx-auto mt-14 max-w-2xl space-y-3">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;

          return (
            <ScrollReveal key={item.question} delay={index * 40}>
              <div className={cn(landingCardStaticClassName, "overflow-hidden")}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-medium text-[var(--foreground)]">
                    {item.question}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-lg text-[var(--text-subtle)] transition-transform duration-200",
                      isOpen && "rotate-45",
                    )}
                    aria-hidden
                  >
                    +
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-t border-[var(--surface-border)] px-6 py-5">
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                      {item.answer}
                    </p>
                  </div>
                ) : null}
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
