"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IosAvatar,
  IosBanner,
  IosCard,
  IosIconButton,
  IosList,
  IosScreen,
  IosSegmentedControl,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { IosTransactionDetailSheet } from "@/components/native/ios/IosTransactionDetailSheet";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { DeleteTransactionModal } from "@/components/transactions/DeleteTransactionModal";
import { EditTransactionModal } from "@/components/transactions/EditTransactionModal";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import { groupByDay } from "@/lib/transactions/groupByDay";
import {
  describeTransactionFilters,
  parseTransactionFilters,
  serializeTransactionFilters,
} from "@/lib/transactions/filterParams";
import {
  DEFAULT_TRANSACTION_FILTERS,
  filterAndSortTransactions,
  getTransactionSummary,
  type TransactionFilterState,
} from "@/lib/transactions";
import {
  getDisplayCategory,
  getDisplayMerchant,
} from "@/lib/transactions/categoryPresentation";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";
import { hasLinkedFinancialAccounts } from "@/lib/transactions/accountLookup";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

type TxTab = "all" | "income" | "expense";

function IosTransactionsScreenInner() {
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
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | null>(
    null,
  );
  const searchTimer = useRef<number | null>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    setFilters(parseTransactionFilters(searchParams));
    hasScrolledRef.current = false;
  }, [searchParams]);

  const tab: TxTab =
    filters.type === "income" ? "income" : filters.type === "expense" ? "expense" : "all";

  const syncFiltersToUrl = useCallback(
    (nextFilters: TransactionFilterState) => {
      const params = serializeTransactionFilters(nextFilters);
      const query = params.toString();
      router.replace(query ? `/transactions?${query}` : "/transactions");
    },
    [router],
  );

  const setTab = (next: TxTab) => {
    void triggerHaptic("selection");
    const nextFilters = {
      ...filters,
      type: next === "all" ? ("all" as const) : next,
    };
    setFilters(nextFilters);
    syncFiltersToUrl(nextFilters);
  };

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_TRANSACTION_FILTERS);
    router.replace("/transactions");
  }, [router, setFilters]);

  const plaidEnabled = isPlaidClientEnabled();
  const canSyncPlaid = plaidEnabled && hasLinkedFinancialAccounts(finance);
  const transactions = useMemo(
    () => filterAndSortTransactions(finance, filters),
    [finance, filters],
  );
  const dayGroups = useMemo(() => groupByDay(transactions), [transactions]);
  const summary = useMemo(() => getTransactionSummary(finance), [finance]);
  const filterDescription = describeTransactionFilters(filters);
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.type !== "all" ||
    filters.category !== "all" ||
    Boolean(filters.filterLabel) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  useEffect(() => {
    const targetId = filters.transactionId;
    if (!targetId || hasScrolledRef.current || finance.isLoading) return;
    const exists = finance.transactions.some((transaction) => transaction.id === targetId);
    if (!exists) return;
    const element = document.getElementById(`transaction-${targetId}`);
    if (!element) return;
    hasScrolledRef.current = true;
    setHighlightedTransactionId(targetId);
    setDetailTransactionId(targetId);
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = window.setTimeout(() => setHighlightedTransactionId(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [filters.transactionId, finance.isLoading, finance.transactions, transactions.length]);

  const onSearch = (value: string) => {
    setFilters((current) => {
      const next = { ...current, search: value };
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
      searchTimer.current = window.setTimeout(() => syncFiltersToUrl(next), 180);
      return next;
    });
  };

  if (finance.isLoading) {
    return <IosSkeletonScreen rows={6} />;
  }

  const editTransaction =
    finance.transactions.find((transaction) => transaction.id === editTransactionId) ??
    null;
  const deleteTransaction =
    finance.transactions.find((transaction) => transaction.id === deleteTransactionId) ??
    null;
  const detailTransaction =
    finance.transactions.find((transaction) => transaction.id === detailTransactionId) ??
    null;

  return (
    <IosScreen>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-muted)]">Activity</p>
          <p className="mt-1 text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
            {transactions.length}
            <span className="ml-2 text-[15px] font-medium text-[var(--text-muted)]">
              shown
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canSyncPlaid ? (
            <IosTextButton
              onClick={() => {
                void triggerHaptic("light");
                void syncBank().then((results) => {
                  const added = results.reduce(
                    (sum, result) => sum + result.transactionsAdded,
                    0,
                  );
                  showToast({
                    title: added > 0 ? "Bank sync complete" : "Sync finished",
                    subtitle:
                      added > 0
                        ? `Imported ${added} transaction${added === 1 ? "" : "s"}.`
                        : "No new transactions yet.",
                  });
                });
              }}
            >
              {isSyncing ? "…" : "Sync"}
            </IosTextButton>
          ) : null}
          <IosIconButton
            label="Add transaction"
            onClick={() => {
              void triggerHaptic("light");
              setIsCreateOpen(true);
            }}
          >
            <span className="text-xl leading-none">+</span>
          </IosIconButton>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[16px] bg-white/[0.04] px-4 py-3">
        <div>
          <p className="text-[12px] font-medium text-[var(--text-muted)]">In this month</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-[var(--success)]">
            {formatCurrency(summary.monthIncome)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Out this month</p>
          <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(summary.monthExpenses)}
          </p>
        </div>
      </div>

      <IosSegmentedControl
        variant="pills"
        value={tab}
        onChange={setTab}
        options={[
          { value: "all", label: "All" },
          { value: "income", label: "Income" },
          { value: "expense", label: "Expenses" },
        ]}
      />

      {hasActiveFilters ? (
        <IosBanner
          title="Filtered"
          subtitle={filterDescription}
          action={
            <IosTextButton className="px-0" onClick={clearFilters}>
              Clear
            </IosTextButton>
          }
        />
      ) : null}

      <label className="block">
        <span className="sr-only">Search transactions</span>
        <input
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          value={filters.search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search merchant, notes, category"
          className="min-h-11 w-full rounded-[12px] border border-white/[0.08] bg-white/[0.05] px-3 text-[16px] text-[var(--foreground)] outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)]"
        />
      </label>

      {transactions.length === 0 ? (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            {hasActiveFilters ? "No matching transactions" : "No transactions yet"}
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {hasActiveFilters
              ? "Try clearing filters or searching a different merchant."
              : "Add a transaction or sync linked accounts."}
          </p>
        </IosCard>
      ) : (
        <div className="flex flex-col gap-4">
          {dayGroups.map((group) => (
            <section key={group.key}>
              <h2 className="ios-day-header px-1 py-1.5 text-[13px] font-semibold text-[var(--text-muted)]">
                {group.label}
              </h2>
              <IosList>
                {group.items.map((transaction) => {
                  const isTransfer = isConfidentInternalTransfer(finance, transaction);
                  const displayCategory = isTransfer
                    ? "Transfer"
                    : getDisplayCategory(transaction.category);
                  const label = getDisplayMerchant({
                    notes: transaction.notes,
                    category: transaction.category,
                    type: isTransfer ? "transfer" : transaction.type,
                  });
                  const isIncome = transaction.type === "income" && !isTransfer;
                  const highlighted = highlightedTransactionId === transaction.id;

                  return (
                    <li
                      key={transaction.id}
                      id={`transaction-${transaction.id}`}
                      className="border-b border-white/[0.05] last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void triggerHaptic("selection");
                          setDetailTransactionId(transaction.id);
                        }}
                        className={cn(
                          "ios-list-row flex min-h-[52px] w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.04]",
                          highlighted && "bg-[var(--accent)]/15",
                        )}
                      >
                        <IosAvatar
                          fallback={label.slice(0, 1).toUpperCase()}
                          tone={isIncome ? "success" : "muted"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-[var(--foreground)]">
                            {label}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                            {displayCategory}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[15px] font-medium tabular-nums",
                            isIncome ? "text-[var(--success)]" : "text-[var(--foreground)]",
                          )}
                        >
                          {isIncome ? "+" : "−"}
                          {formatCurrency(Math.abs(transaction.amount))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </IosList>
            </section>
          ))}
          {finance.transactionsMeta?.truncated ? (
            <button
              type="button"
              disabled={finance.isLoadingOlderTransactions}
              onClick={() => {
                void triggerHaptic("light");
                void finance.loadOlderTransactions();
              }}
              className="min-h-12 rounded-[14px] bg-white/[0.06] text-[15px] font-semibold text-[var(--accent-light)] disabled:opacity-60"
            >
              {finance.isLoadingOlderTransactions ? "Loading older…" : "Load older"}
            </button>
          ) : null}
        </div>
      )}

      <IosTransactionDetailSheet
        transaction={detailTransaction}
        finance={finance}
        onClose={() => setDetailTransactionId(null)}
        onEdit={() => {
          if (!detailTransaction) return;
          setDetailTransactionId(null);
          setEditTransactionId(detailTransaction.id);
        }}
        onDelete={() => {
          if (!detailTransaction) return;
          setDetailTransactionId(null);
          setDeleteTransactionId(detailTransaction.id);
        }}
      />
      <AddTransactionModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <EditTransactionModal
        transaction={editTransaction}
        onClose={() => setEditTransactionId(null)}
      />
      <DeleteTransactionModal
        transaction={deleteTransaction}
        onClose={() => setDeleteTransactionId(null)}
      />
    </IosScreen>
  );
}

export function IosTransactionsScreen() {
  return (
    <Suspense fallback={<IosSkeletonScreen rows={6} />}>
      <IosTransactionsScreenInner />
    </Suspense>
  );
}
