"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  buildTransactionsHref,
  describeTransactionFilters,
  parseTransactionFilters,
  serializeTransactionFilters,
} from "@/lib/transactions/filterParams";
import {
  filterAndSortTransactions,
  getTransactionSummary,
  type TransactionFilterState,
} from "@/lib/transactions";
import {
  hasLinkedFinancialAccounts,
} from "@/lib/transactions/accountLookup";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { cn } from "@/components/ui/cn";

function TransactionsContentInner() {
  const { syncBank, isSyncing, ...finance } = useFinance();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilterState>(() =>
    parseTransactionFilters(searchParams),
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTransactionId, setEditTransactionId] = useState<string | null>(null);
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null);
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | null>(
    null,
  );
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    setFilters(parseTransactionFilters(searchParams));
    hasScrolledRef.current = false;
  }, [searchParams]);

  const syncFiltersToUrl = useCallback(
    (nextFilters: TransactionFilterState) => {
      const params = serializeTransactionFilters(nextFilters);
      const query = params.toString();
      router.replace(query ? `/transactions?${query}` : "/transactions");
    },
    [router],
  );

  const handleFiltersChange = useCallback(
    (nextFilters: TransactionFilterState) => {
      setFilters(nextFilters);
      syncFiltersToUrl(nextFilters);
    },
    [syncFiltersToUrl],
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_TRANSACTION_FILTERS);
    router.replace("/transactions");
  }, [router]);

  const plaidEnabled = isPlaidClientEnabled();
  const canSyncPlaid = plaidEnabled && hasLinkedFinancialAccounts(finance);

  const handleSyncNow = useCallback(async () => {
    try {
      const results = await syncBank();
      const added = results.reduce(
        (sum, result) => sum + result.transactionsAdded,
        0,
      );
      const backfilled = results.reduce(
        (sum, result) => sum + (result.diagnostics?.backfill?.inserted ?? 0),
        0,
      );

      showToast({
        title: added + backfilled > 0 ? "Bank sync complete" : "Sync finished",
        subtitle:
          added + backfilled > 0
            ? `Imported ${added + backfilled} transaction${added + backfilled === 1 ? "" : "s"}.`
            : "No new transactions yet. If you just linked a credit card, wait a minute and sync again.",
      });
    } catch (error) {
      showToast({
        title: "Sync failed",
        subtitle: error instanceof Error ? error.message : "Try again from Settings.",
      });
    }
  }, [showToast, syncBank]);

  const summary = useMemo(() => getTransactionSummary(finance), [finance]);
  const transactions = useMemo(
    () => filterAndSortTransactions(finance, filters),
    [finance, filters],
  );

  const hasActiveFilters = useMemo(() => {
    const serialized = serializeTransactionFilters(filters).toString();
    return serialized.length > 0;
  }, [filters]);

  const filterDescription = useMemo(
    () => describeTransactionFilters(filters),
    [filters],
  );

  useEffect(() => {
    const targetId = filters.transactionId;

    if (!targetId || hasScrolledRef.current) {
      return;
    }

    const exists = finance.transactions.some((transaction) => transaction.id === targetId);

    if (!exists) {
      return;
    }

    const element = document.getElementById(`transaction-${targetId}`);

    if (!element) {
      return;
    }

    hasScrolledRef.current = true;
    setHighlightedTransactionId(targetId);
    element.scrollIntoView({ behavior: "smooth", block: "center" });

    const timeout = window.setTimeout(() => {
      setHighlightedTransactionId(null);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [filters.transactionId, finance.transactions, transactions.length]);

  if (finance.isLoading) {
    return <SkeletonGrid count={3} />;
  }

  const editTransaction =
    finance.transactions.find((transaction) => transaction.id === editTransactionId) ??
    null;
  const deleteTransaction =
    finance.transactions.find((transaction) => transaction.id === deleteTransactionId) ??
    null;

  return (
    <div className={cn(pageContainerWideClassName)}>
      <PageHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canSyncPlaid ? (
              <Button
                variant="secondary"
                disabled={isSyncing}
                onClick={() => void handleSyncNow()}
              >
                {isSyncing ? "Syncing..." : "Sync now"}
              </Button>
            ) : null}
            <Button onClick={() => setIsCreateOpen(true)}>Add transaction</Button>
          </div>
        }
      />

      {hasActiveFilters ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#0077ed]/25 bg-[#0077ed]/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/75">
            Showing transactions related to:{" "}
            <span className="font-medium text-white">{filterDescription}</span>
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Link href={buildTransactionsHref({ type: "income", filterLabel: "Income this month" })}>
          <StatCard
            label="Income this month"
            value={formatCurrency(summary.monthIncome)}
            change={`${summary.monthCount} transactions`}
            positive
          />
        </Link>
        <Link href={buildTransactionsHref({ type: "expense", filterLabel: "Expenses this month" })}>
          <StatCard
            label="Expenses this month"
            value={formatCurrency(summary.monthExpenses)}
            change={`${summary.count} total recorded`}
            positive={false}
          />
        </Link>
      </div>

      <section className="rounded-3xl border border-white/[0.04] bg-white/[0.015] p-7 sm:p-8">
        <TransactionFilters filters={filters} onChange={handleFiltersChange} />
      </section>

      {finance.accounts.length === 0 && finance.debts.length === 0 ? (
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
          title={hasActiveFilters ? "No matching transactions" : "No transactions yet"}
          description={
            hasActiveFilters
              ? `Nothing matched ${filterDescription}. Try clearing filters or broadening your search.`
              : canSyncPlaid
                ? "Sync your linked accounts to import recent activity, or add a transaction manually."
                : "Add your first transaction or adjust your search and filters."
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : canSyncPlaid ? (
              <Button disabled={isSyncing} onClick={() => void handleSyncNow()}>
                {isSyncing ? "Syncing..." : "Sync linked accounts"}
              </Button>
            ) : (
              <Button onClick={() => setIsCreateOpen(true)}>Add transaction</Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              data={finance}
              highlighted={highlightedTransactionId === transaction.id}
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

export function TransactionsContent() {
  return (
    <Suspense fallback={<SkeletonGrid count={3} />}>
      <TransactionsContentInner />
    </Suspense>
  );
}
