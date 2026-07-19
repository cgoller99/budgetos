"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge, Card, CardContent, CardHeader, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { getBillStatusVariant, getBillsDueThisWeek } from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import {
  listRowAmountClassName,
  listRowClassName,
  listRowLabelClassName,
} from "@/components/ui/tokens";

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
      <p className="py-2 text-sm text-[var(--text-muted)]">
        Nothing due this week.{" "}
        <Link href="/bills" className="text-[var(--accent)] hover:underline">
          Bills
        </Link>
      </p>
    ) : (
      <ul className="space-y-0.5">
        {bills.map((bill) => (
          <li key={bill.id} className={listRowClassName}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={listRowLabelClassName}>{bill.name}</p>
                <Badge variant={getBillStatusVariant(bill.status)}>
                  {bill.statusLabel}
                </Badge>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                {bill.formattedDueDate}
              </p>
            </div>
            <span className={listRowAmountClassName}>
              {formatCurrency(bill.amount)}
            </span>
          </li>
        ))}
      </ul>
    );

  if (embedded) {
    return (
      <div>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-lg">
            Bills Due Soon
          </h2>
          <PanelLink href="/bills">View all</PanelLink>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Bills Due Soon"
        action={<PanelLink href="/bills">View all</PanelLink>}
      />
      <CardContent>{content}</CardContent>
    </Card>
  );
}
