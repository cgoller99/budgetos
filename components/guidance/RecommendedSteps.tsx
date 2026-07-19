import Link from "next/link";
import { Card } from "@/components/ui";

const STEPS = [
  { href: "/accounts", label: "Accounts", helper: "Add balances" },
  { href: "/income", label: "Income", helper: "Add paychecks" },
  { href: "/bills", label: "Bills", helper: "Track due dates" },
  { href: "/savings", label: "Savings", helper: "Set a goal" },
  { href: "/settings", label: "Household", helper: "Invite a partner" },
] as const;

export function RecommendedSteps() {
  return (
    <Card padding="default">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-base font-semibold text-[var(--foreground)]">
            Recommended setup
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Five quick places to make the dashboard more useful.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-5 lg:min-w-[34rem]">
          {STEPS.map((step, index) => (
            <Link
              key={step.href}
              href={step.href}
              className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-3 transition-all duration-200 hover:border-[var(--accent)]/25 hover:bg-[var(--accent)]/8"
            >
              <span className="text-xs font-semibold text-[var(--accent)]">
                {index + 1}
              </span>
              <span className="mt-1 block text-sm font-medium text-[var(--foreground)]">
                {step.label}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                {step.helper}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}
