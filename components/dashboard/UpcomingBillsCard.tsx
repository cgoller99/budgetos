"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { getBillStatusVariant, getBillsDueThisWeek } from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";

const MAX_BILLS = 4;

type UpcomingBillsCardProps = {
  embedded?: boolean;
};

export function UpcomingBillsCard({ embedded = false }: UpcomingBillsCardProps) {
  const finance = useFinance();

  const bills = useMemo(
    () => getBillsDueThisWeek(finance).slice(0, MAX_BILLS),
    [finance],
  );

  const content =
    bills.length === 0 ? (
      <p className="text-base text-white/38">
        Nothing due this week.{" "}
        <Link href="/bills" className="text-white/60 hover:text-white">
          Bills
        </Link>
      </p>
    ) : (
      <ul className="space-y-4">
        {bills.map((bill) => (
          <li
            key={bill.id}
            className="flex items-center justify-between gap-4 py-1"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="truncate text-base font-medium text-white">
                  {bill.name}
                </p>
                <Badge variant={getBillStatusVariant(bill.status)}>
                  {bill.statusLabel}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/38">{bill.formattedDueDate}</p>
            </div>
            <p className="shrink-0 text-base font-semibold tabular-nums text-white">
              {formatCurrency(bill.amount)}
            </p>
          </li>
        ))}
      </ul>
    );

  if (embedded) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Upcoming bills
          </h2>
          <Link
            href="/bills"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            View all
          </Link>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card hover>
      <CardHeader
        title="Upcoming bills"
        action={
          <Link
            href="/bills"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            View all
          </Link>
        }
      />
      <CardContent>{content}</CardContent>
    </Card>
  );
}
