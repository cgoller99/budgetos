"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getAllocationProgress, resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import {
  daysUntilPayDate,
  formatPayDate,
  getPaycheckIndexInMonth,
  isExtraPaycheckMonth,
} from "@/lib/incomePlan/payDates";
import { formatCurrency } from "@/lib/finance/format";
import type { MarkPaycheckReceivedInput } from "@/lib/incomePlan/types";

export function NextPaycheckCard() {
  const finance = useFinance();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const plan = finance.incomePlan;

  const breakdown = useMemo(() => {
    if (!plan) return [];
    return resolveAllocationAmounts(plan);
  }, [plan]);

  const extraMonth = useMemo(
    () => (plan ? isExtraPaycheckMonth(plan) : false),
    [plan],
  );

  const paycheckIndex = useMemo(() => {
    if (!plan) return 0;
    return getPaycheckIndexInMonth(plan, plan.nextPayDate);
  }, [plan]);

  if (!plan) {
    return (
      <Card hover>
        <CardHeader
          title="Next paycheck"
          action={
            <Link
              href="/income?tab=plan"
              className="text-sm text-[var(--accent)] transition-colors hover:underline"
            >
              Set up
            </Link>
          }
        />
        <CardContent>
          <p className="text-base text-[var(--text-muted)]">
            Tell Buxme where each paycheck goes. Setup takes about five minutes.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleMarkReceived(input?: MarkPaycheckReceivedInput) {
    setIsSubmitting(true);

    try {
      await finance.markIncomePlanPaycheckReceived(input);
      showToast({
        title: "Paycheck received",
        subtitle: "Allocations applied and dashboard updated.",
      });
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsSubmitting(false);
    }
  }

  const daysUntil = daysUntilPayDate(plan.nextPayDate);

  return (
    <Card hover>
      <CardHeader
        title="Next paycheck"
        action={
          <Link
            href="/income?tab=plan"
            className="text-sm text-[var(--accent)] transition-colors hover:underline"
          >
            Edit plan
          </Link>
        }
      />

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--text-muted)]">
              {formatPayDate(plan.nextPayDate)}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              +{formatCurrency(plan.paycheckAmount)}
            </p>
          </div>
          <Badge variant="accent">
            {daysUntil === 0
              ? "Today"
              : daysUntil === 1
                ? "Tomorrow"
                : `${daysUntil} days`}
          </Badge>
        </div>

        {extraMonth && paycheckIndex >= 3 && (
          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Extra paycheck month
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              This is paycheck #{paycheckIndex} this month. Consider debt, savings,
              or a treat-yourself fund.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {breakdown.map(({ allocation, amount }) => (
            <li
              key={allocation.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="text-lg">
                  {allocation.icon}
                </span>
                <span className="truncate text-sm font-medium text-[var(--foreground)]">
                  {allocation.name}
                </span>
                {allocation.isRemainingBalance && (
                  <Badge variant="accent" className="shrink-0">
                    Remaining
                  </Badge>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(amount)}
              </span>
            </li>
          ))}
        </ul>

        <Button
          fullWidth
          disabled={isSubmitting || finance.isSyncing}
          onClick={() => void handleMarkReceived()}
        >
          {isSubmitting ? "Applying…" : "Mark Paycheck Received"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function MonthlyAllocationProgress() {
  const finance = useFinance();
  const plan = finance.incomePlan;

  const progress = useMemo(() => {
    if (!plan) return [];
    return getAllocationProgress(plan, finance.incomePlanPaychecks ?? []);
  }, [finance.incomePlanPaychecks, plan]);

  if (!plan || progress.length === 0) {
    return null;
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Monthly progress"
        description="How much of each allocation you've received this month."
      />
      <CardContent className="space-y-4">
        {progress
          .filter((item) => item.monthlyTarget > 0)
          .map((item) => {
            const percent = Math.min(
              (item.receivedThisMonth / item.monthlyTarget) * 100,
              100,
            );

            return (
              <div key={item.allocationId}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{item.icon}</span>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-[var(--text-muted)]">
                    {formatCurrency(item.receivedThisMonth)} /{" "}
                    {formatCurrency(item.monthlyTarget)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
