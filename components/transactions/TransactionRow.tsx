"use client";

import { Badge, Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatCurrency } from "@/lib/finance/format";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import {
  formatTransactionDate,
  getTransactionTypeLabel,
} from "@/lib/transactions";

type TransactionRowProps = {
  transaction: Transaction;
  data: FinanceData;
  highlighted?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function getAccountName(data: FinanceData, accountId: string): string {
  return data.accounts.find((account) => account.id === accountId)?.name ?? "Account";
}

function getTypeVariant(
  type: Transaction["type"],
): "success" | "danger" | "accent" | "default" {
  switch (type) {
    case "income":
      return "success";
    case "expense":
      return "danger";
    case "transfer":
      return "accent";
    default:
      return "default";
  }
}

export function TransactionRow({
  transaction,
  data,
  highlighted = false,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const accountName = getAccountName(data, transaction.accountId);
  const transferName = transaction.transferAccountId
    ? getAccountName(data, transaction.transferAccountId)
    : null;
  const signedAmount =
    transaction.type === "expense"
      ? -transaction.amount
      : transaction.type === "income"
        ? transaction.amount
        : transaction.amount;

  return (
    <article
      id={`transaction-${transaction.id}`}
      className={cn(
        "bill-card-enter flex flex-col gap-5 rounded-3xl border bg-white/[0.015] p-5 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between sm:p-6",
        highlighted
          ? "border-[#0077ed]/40 bg-[#0077ed]/10 ring-2 ring-[#0077ed]/25"
          : "border-white/[0.04] hover:border-white/[0.07]",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant={getTypeVariant(transaction.type)}>
            {getTransactionTypeLabel(transaction.type)}
          </Badge>
          <Badge variant="default">{transaction.category}</Badge>
        </div>

        <p className="mt-4 truncate text-base font-medium text-white">
          {transaction.notes || transaction.category}
        </p>

        <p className="mt-1.5 text-sm text-white/38">
          {formatTransactionDate(transaction.date)} · {accountName}
          {transferName ? ` → ${transferName}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-4 sm:shrink-0">
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            transaction.type === "income" && "text-emerald-400/90",
            transaction.type === "expense" && "text-rose-300/90",
            transaction.type === "transfer" && "text-[#0077ed]",
          )}
        >
          {transaction.type === "transfer"
            ? formatCurrency(transaction.amount)
            : formatCurrency(signedAmount)}
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}
