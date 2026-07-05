"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { DeleteTransactionModal } from "@/components/transactions/DeleteTransactionModal";
import { EditTransactionModal } from "@/components/transactions/EditTransactionModal";
import {
  DEFAULT_TRANSACTION_FILTERS,
  TransactionFilters,
} from "@/components/transactions/TransactionFilters";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { Button, EmptyState, PageHeader, SkeletonGrid, StatCard } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  filterAndSortTransactions,
  getTransactionSummary,
} from "@/lib/transactions";
import { cn } from "@/components/ui/cn";

export function TransactionsContent() {
  const finance = useFinance();
  const [filters, setFilters] = useState(DEFAULT_TRANSACTION_FILTERS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTransactionId, setEditTransactionId] = useState<string | null>(
    null,
  );
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(
    null,
  );

  const summary = useMemo(() => getTransactionSummary(finance), [finance]);
  const transactions = useMemo(
    () => filterAndSortTransactions(finance, filters),
    [finance, filters],
  );

  if (finance.isLoading) {
    return <SkeletonGrid count={3} />;
  }

  const editTransaction =
    finance.transactions.find(
      (transaction) => transaction.id === editTransactionId,
    ) ?? null;
  const deleteTransaction =
    finance.transactions.find(
      (transaction) => transaction.id === deleteTransactionId,
    ) ?? null;

  return (
    <div className={cn(pageContainerWideClassName)}>
      <PageHeader
        action={
          <Button onClick={() => setIsCreateOpen(true)}>Add transaction</Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard
          label="Income this month"
          value={formatCurrency(summary.monthIncome)}
          change={`${summary.monthCount} transactions`}
          positive
        />
        <StatCard
          label="Expenses this month"
          value={formatCurrency(summary.monthExpenses)}
          change={`${summary.count} total recorded`}
          positive={false}
        />
      </div>

      <section className="rounded-3xl border border-white/[0.04] bg-white/[0.015] p-7 sm:p-8">
        <TransactionFilters filters={filters} onChange={setFilters} />
      </section>

      {finance.accounts.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="Add an account first"
          description="Transactions need at least one account to update balances."
          action={
            <Link href="/accounts">
              <Button>Go to accounts</Button>
            </Link>
          }
        />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No transactions yet"
          description="Add your first transaction or adjust your search and filters."
          action={
            <Button onClick={() => setIsCreateOpen(true)}>
              Add transaction
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              data={finance}
              onEdit={() => setEditTransactionId(transaction.id)}
              onDelete={() => setDeleteTransactionId(transaction.id)}
            />
          ))}
        </div>
      )}

      <AddTransactionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <EditTransactionModal
        transaction={editTransaction}
        onClose={() => setEditTransactionId(null)}
      />
      <DeleteTransactionModal
        transaction={deleteTransaction}
        onClose={() => setDeleteTransactionId(null)}
      />
    </div>
  );
}
