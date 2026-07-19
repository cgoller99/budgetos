"use client";

import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import {
  listRowAmountClassName,
  listRowClassName,
  listRowLabelClassName,
} from "@/components/ui/tokens";
import { formatCurrency } from "@/lib/finance/format";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { formatTransactionDate } from "@/lib/transactions";
import { getLinkedAccountName } from "@/lib/transactions/accountLookup";

type TransactionRowProps = {
  transaction: Transaction;
  data: FinanceData;
  highlighted?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function TransactionRow({
  transaction,
  data,
  highlighted = false,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const accountName = getLinkedAccountName(data, transaction.accountId);
  const transferName = transaction.transferAccountId
    ? getLinkedAccountName(data, transaction.transferAccountId)
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
        "bill-card-enter flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-3.5 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between",
        highlighted &&
          "border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[var(--accent-muted)]",
      )}
    >
      <div className={cn("min-w-0 flex-1 sm:contents", listRowClassName)}>
        <div className="min-w-0 flex-1">
          <p className={listRowLabelClassName}>
            {transaction.notes || transaction.category}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {formatTransactionDate(transaction.date)} · {accountName}
            {transferName ? ` → ${transferName}` : ""}
          </p>
        </div>

        <p
          className={cn(
            listRowAmountClassName,
            transaction.type === "income" && "text-[var(--success)]",
            transaction.type === "expense" && "text-[var(--danger)]",
            transaction.type === "transfer" && "text-[var(--accent-light)]",
          )}
        >
          {transaction.type === "transfer"
            ? formatCurrency(transaction.amount)
            : `${signedAmount >= 0 ? "+" : ""}${formatCurrency(Math.abs(signedAmount))}`}
        </p>
      </div>

      <div className="flex gap-2 sm:shrink-0">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </article>
  );
}
