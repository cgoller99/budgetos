"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  PanelLink,
} from "@/components/ui";
import {
  listRowAmountClassName,
  listRowClassName,
  listRowLabelClassName,
} from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { formatTransactionDate } from "@/lib/transactions";
import { cn } from "@/components/ui/cn";

const MAX_ITEMS = 5;

export function RecentTransactionsCard() {
  const finance = useFinance();

  const transactions = useMemo(
    () =>
      [...finance.transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, MAX_ITEMS),
    [finance.transactions],
  );

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Recent Transactions"
        action={<PanelLink href="/transactions">View all</PanelLink>}
      />
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-4 text-sm text-[var(--text-muted)]">
            No transactions yet.{" "}
            <Link href="/transactions" className="text-[#0077ed] hover:underline">
              Add one
            </Link>
          </p>
        ) : (
          <ul className="space-y-0.5">
            {transactions.map((transaction) => {
              const signedAmount =
                transaction.type === "expense"
                  ? -transaction.amount
                  : transaction.amount;

              return (
                <li key={transaction.id} className={listRowClassName}>
                  <div className="min-w-0">
                    <p className={listRowLabelClassName}>
                      {transaction.notes || transaction.category}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {formatTransactionDate(transaction.date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      listRowAmountClassName,
                      signedAmount >= 0
                        ? "text-emerald-400/90"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    {signedAmount >= 0 ? "+" : ""}
                    {formatCurrency(Math.abs(signedAmount))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
