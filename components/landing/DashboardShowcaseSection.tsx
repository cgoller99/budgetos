"use client";

import { useRef } from "react";
import { cn } from "@/components/ui/cn";
import {
  ScrollReveal,
  SectionHeading,
  landingCardStaticClassName,
  landingSectionClassName,
} from "./shared";

const SHOWCASES = [
  {
    id: "dashboard",
    title: "Dashboard",
    preview: (
      <div className="grid grid-cols-2 gap-2 p-3">
        {["Net Worth", "Safe To Spend", "Health", "Bills"].map((label) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-2"
          >
            <p className="text-[9px] text-[var(--text-muted)]">{label}</p>
            <p className="text-xs font-semibold text-[var(--foreground)]">$—</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "bills",
    title: "Bills",
    preview: (
      <div className="space-y-1.5 p-3">
        {["Rent", "Internet", "Insurance"].map((bill, index) => (
          <div
            key={bill}
            className="flex items-center justify-between rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-2 py-1.5"
          >
            <span className="text-[10px] text-[var(--text-secondary)]">{bill}</span>
            <span
              className={cn(
                "text-[9px] font-medium",
                index === 0 ? "text-amber-400/80" : "text-[var(--text-muted)]",
              )}
            >
              {index === 0 ? "Due soon" : "Paid"}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "goals",
    title: "Goals",
    preview: (
      <div className="space-y-2 p-3">
        {[
          { name: "Emergency", pct: 72 },
          { name: "Vacation", pct: 45 },
        ].map((goal) => (
          <div key={goal.name}>
            <div className="mb-1 flex justify-between text-[9px] text-[var(--text-muted)]">
              <span>{goal.name}</span>
              <span>{goal.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--surface-border)]">
              <div
                className="h-full rounded-full bg-[#0077ed]"
                style={{ width: `${goal.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "calendar",
    title: "Calendar",
    preview: (
      <div className="grid grid-cols-7 gap-0.5 p-3">
        {Array.from({ length: 14 }, (_, index) => (
          <div
            key={index}
            className={cn(
              "aspect-square rounded text-[8px] leading-[1.6] text-[var(--text-muted)]",
              index === 4 && "bg-[#0077ed]/20 text-[#4da3ff]",
              index === 11 && "bg-amber-500/15 text-amber-400/90",
            )}
          >
            {index + 1}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "investments",
    title: "Investments",
    preview: (
      <div className="p-3">
        <p className="text-lg font-semibold text-[var(--foreground)]">$97,630</p>
        <p className="text-[9px] text-emerald-400/80">+$840 this month</p>
        <div className="mt-2 flex h-12 items-end gap-1">
          {[30, 45, 38, 55, 48, 62, 58].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-[#0077ed]/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "reports",
    title: "Reports",
    preview: (
      <div className="space-y-1.5 p-3">
        {["Spending", "Income", "Savings"].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]"
          >
            <span>{row}</span>
            <span className="text-[var(--text-muted)]">View →</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "money-flow",
    title: "Money Flow",
    preview: (
      <div className="space-y-2 p-3">
        {[
          { label: "Income", pct: 80 },
          { label: "Spending", pct: 55 },
        ].map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-[9px] text-[var(--text-muted)]">
              <span>{row.label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-border)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0077ed] to-[#4da3ff]"
                style={{ width: `${row.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "financial-health",
    title: "Financial Health",
    preview: (
      <div className="flex items-center justify-center p-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--surface-border)" strokeWidth="3" />
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
          <span className="absolute text-sm font-semibold text-[var(--foreground)]">82</span>
        </div>
      </div>
    ),
  },
  {
    id: "safe-to-spend",
    title: "Safe To Spend",
    preview: (
      <div className="p-4 text-center">
        <p className="text-[9px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
          This week
        </p>
        <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">$1,840</p>
        <p className="mt-1 text-[9px] text-[var(--text-subtle)]">After bills & goals</p>
      </div>
    ),
  },
] as const;

export function DashboardShowcaseSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section id="showcase" className={cn(landingSectionClassName, "overflow-hidden")}>
      <ScrollReveal>
        <SectionHeading
          eyebrow="Product"
          title="Every view, beautifully designed"
          description="From dashboard to reports — a consistent, premium experience across your entire financial workspace."
        />
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <div
          ref={scrollRef}
          className="landing-showcase-scroll mt-14 flex gap-5 overflow-x-auto px-6 pb-4 sm:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
        >
          {SHOWCASES.map((item) => (
            <div
              key={item.id}
              className={cn(
                landingCardStaticClassName,
                "w-[220px] shrink-0 overflow-hidden sm:w-[240px]",
              )}
            >
              <div className="border-b border-[var(--surface-border)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--foreground)]">{item.title}</p>
              </div>
              <div className="min-h-[140px] bg-[var(--surface-subtle)]">{item.preview}</div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
