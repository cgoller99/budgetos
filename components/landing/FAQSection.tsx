"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { cardBaseClassName } from "@/components/ui/tokens";
import { SectionHeading } from "./shared";

const FAQ_ITEMS = [
  {
    question: "What is Buxme?",
    answer:
      "Buxme is a personal finance workspace for tracking accounts, income, bills, transactions, savings goals, debt, and reports — all in one unified dashboard.",
  },
  {
    question: "Is Buxme free?",
    answer:
      "You can create an account and start organizing your finances at no cost. Paid plans are coming soon with additional features for power users and households.",
  },
  {
    question: "Do I need to connect my bank?",
    answer:
      "No. Buxme is designed for manual tracking with full control over your data. You record income, expenses, and account balances on your terms.",
  },
  {
    question: "Can I share finances with a partner?",
    answer:
      "Household sharing is supported. Invite a partner to collaborate on shared accounts, bills, and goals within a single workspace.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. Your account is protected with industry-standard authentication, encrypted connections, and secure cloud infrastructure. You own your data.",
  },
  {
    question: "Can I try it before committing?",
    answer:
      "Demo mode lets you explore Buxme with realistic sample data — perfect for seeing how the dashboard, bills, and goals work before adding your own numbers.",
  },
] as const;

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="px-6 py-20 sm:py-28">
      <SectionHeading
        eyebrow="FAQ"
        title="Common questions"
        description="Everything you need to know before getting started."
      />

      <div className="mx-auto mt-14 max-w-2xl space-y-3">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;

          return (
            <div key={item.question} className={cn(cardBaseClassName, "overflow-hidden")}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.02]"
                aria-expanded={isOpen}
              >
                <span className="text-base font-medium text-white">
                  {item.question}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-lg text-white/35 transition-transform duration-200",
                    isOpen && "rotate-45",
                  )}
                  aria-hidden
                >
                  +
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-white/[0.04] px-6 py-5">
                  <p className="text-sm leading-relaxed text-white/42">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
