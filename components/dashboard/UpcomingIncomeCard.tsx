"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { getUpcomingIncome } from "@/lib/finance/income";
import { formatCurrency } from "@/lib/finance/format";

const MAX_INCOME = 4;

export function UpcomingIncomeCard() {
  const finance = useFinance();

  const income = useMemo(
    () => getUpcomingIncome(finance).slice(0, MAX_INCOME),
    [finance],
  );

  return (
    <Card hover>
      <CardHeader
        title="Upcoming income"
        action={
          <Link
            href="/income"
            className="text-sm text-white/40 transition-colors hover:text-[var(--accent-light)]"
          >
            View all
          </Link>
        }
      />

      <CardContent>
        {income.length === 0 ? (
          <p className="text-base text-white/38">
            No paychecks scheduled.{" "}
            <Link href="/income" className="text-[var(--accent-light)] hover:text-white">
              Add income
            </Link>
          </p>
        ) : (
          <ul className="space-y-4">
            {income.map((source) => (
              <li
                key={source.id}
                className="flex items-center justify-between gap-4 py-1"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="truncate text-base font-medium text-white">
                      {source.name}
                    </p>
                    <Badge variant="accent">
                      {source.daysUntil === 0
                        ? "Today"
                        : source.daysUntil === 1
                          ? "Tomorrow"
                          : `${source.daysUntil} days`}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-white/38">
                    {source.formattedDate}
                  </p>
                </div>
                <p className="shrink-0 text-base font-semibold tabular-nums text-[var(--accent-light)]">
                  {formatCurrency(source.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
