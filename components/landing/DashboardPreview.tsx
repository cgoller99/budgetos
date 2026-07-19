"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { landingCardStaticClassName } from "./shared";

const KPI_ITEMS = [
  { label: "Net Worth", value: "$124,580", change: "+$2,340", tone: "positive" },
  { label: "Safe To Spend", value: "$1,840", change: "This week", tone: "neutral" },
  { label: "Financial Health", value: "82", change: "Strong", tone: "positive" },
] as const;

const ALLOCATIONS = [
  { label: "House Fund", amount: "$200", pct: 22 },
  { label: "Spending", amount: "$520", pct: 59 },
  { label: "Investments", amount: "$160", pct: 19 },
] as const;

const GOALS = [
  { name: "Emergency Fund", progress: 72 },
  { name: "Vacation", progress: 45 },
] as const;

const TRANSACTIONS = [
  { name: "Weekly Paycheck", amount: "+$2,880", type: "income" },
  { name: "Rent", amount: "-$1,450", type: "expense" },
  { name: "Groceries", amount: "-$86", type: "expense" },
] as const;

export function DashboardPreview() {
  const [activePanel, setActivePanel] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActivePanel((current) => (current + 1) % 3);
    }, 4200);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-xl lg:mx-0">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,119,237,0.2),transparent)]"
      />

      <div
        className={cn(
          landingCardStaticClassName,
          "landing-slide-in-right relative overflow-hidden border-[var(--accent)]/15 p-4 sm:p-5",
        )}
      >
        <div className="mb-4 flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">Dashboard</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">Good morning</p>
          </div>
          <span className="rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--accent-light)]">
            Live preview
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          {KPI_ITEMS.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 transition-all duration-500",
                activePanel === 0 && index === 0 && "border-[var(--accent)]/30 bg-[var(--accent)]/5",
                activePanel === 1 && index === 1 && "border-[var(--accent)]/30 bg-[var(--accent)]/5",
                activePanel === 2 && index === 2 && "border-[var(--accent)]/30 bg-[var(--accent)]/5",
              )}
            >
              <p className="text-[10px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                {item.value}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[10px]",
                  item.tone === "positive"
                    ? "text-emerald-400/80"
                    : "text-[var(--text-muted)]",
                )}
              >
                {item.change}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--foreground)]">Income Plans</p>
              <span className="text-[10px] text-[var(--text-muted)]">Next Fri</span>
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
              +$880.66
            </p>
            <div className="mt-3 space-y-2">
              {ALLOCATIONS.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-[10px] text-[var(--text-muted)]">
                    <span>{item.label}</span>
                    <span>{item.amount}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-border)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)] transition-all duration-700"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3">
              <p className="text-xs font-medium text-[var(--foreground)]">Goals</p>
              <div className="mt-2 space-y-2">
                {GOALS.map((goal) => (
                  <div key={goal.name}>
                    <div className="mb-1 flex justify-between text-[10px] text-[var(--text-muted)]">
                      <span>{goal.name}</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-border)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]/70"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3">
              <p className="text-xs font-medium text-[var(--foreground)]">Investments</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                $97,630
              </p>
              <p className="text-[10px] text-emerald-400/80">+$840 this month</p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3">
          <p className="text-xs font-medium text-[var(--foreground)]">Recent Transactions</p>
          <div className="mt-2 space-y-1.5">
            {TRANSACTIONS.map((tx) => (
              <div
                key={tx.name}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] hover:bg-[var(--surface-hover)]"
              >
                <span className="text-[var(--text-secondary)]">{tx.name}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    tx.type === "income" ? "text-emerald-400/90" : "text-[var(--text-muted)]",
                  )}
                >
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
