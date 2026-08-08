"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IosAvatar,
  IosBanner,
  IosCard,
  IosIconButton,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
  IosSegmentedControl,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { DeleteTransactionModal } from "@/components/transactions/DeleteTransactionModal";
import { EditTransactionModal } from "@/components/transactions/EditTransactionModal";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  describeTransactionFilters,
  parseTransactionFilters,
  serializeTransactionFilters,
} from "@/lib/transactions/filterParams";
import {
  DEFAULT_TRANSACTION_FILTERS,
  filterAndSortTransactions,
  formatTransactionDate,
  getTransactionSummary,
  type TransactionFilterState,
} from "@/lib/transactions";
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
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setFilters(parseTransactionFilters(searchParams));
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
  const summary = useMemo(() => getTransactionSummary(finance), [finance]);
  const filterDescription = describeTransactionFilters(filters);
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.type !== "all" ||
    filters.category !== "all" ||
    Boolean(filters.filterLabel) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  if (finance.isLoading) {
    return <IosSkeletonScreen rows={6} />;
  }

  const editTransaction =
    finance.transactions.find((transaction) => transaction.id === editTransactionId) ??
    null;
  const deleteTransaction =
    finance.transactions.find((transaction) => transaction.id === deleteTransactionId) ??
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

      <div className="grid grid-cols-2 gap-3">
        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Income</p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--success)]">
            {formatCurrency(summary.monthIncome)}
          </p>
        </IosCard>
        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Expenses</p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(summary.monthExpenses)}
          </p>
        </IosCard>
      </div>

      <IosSegmentedControl
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

      <div className="flex justify-end">
        <IosTextButton
          onClick={() => {
            void triggerHaptic("selection");
            setShowFilters((current) => !current);
          }}
        >
          {showFilters ? "Hide search" : "Search"}
        </IosTextButton>
      </div>

      {showFilters ? (
        <IosCard padding="md">
          <label className="block text-[12px] font-medium text-[var(--text-muted)]">
            Search
          </label>
          <input
            value={filters.search}
            onChange={(event) => {
              const next = { ...filters, search: event.target.value };
              setFilters(next);
              syncFiltersToUrl(next);
            }}
            placeholder="Merchant, notes, category"
            className="mt-2 min-h-11 w-full rounded-[12px] border border-white/[0.08] bg-black/20 px-3 text-[16px] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
        </IosCard>
      ) : null}

      <IosSection title="Transactions">
        {transactions.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              {hasActiveFilters
                ? "No matching transactions."
                : "Add a transaction or sync linked accounts."}
            </p>
          </IosCard>
        ) : (
          <IosList>
            {transactions.map((transaction) => {
              const signed =
                transaction.type === "expense"
                  ? -transaction.amount
                  : transaction.amount;
              const label = transaction.notes || transaction.category;
              return (
                <IosListRow
                  key={transaction.id}
                  title={label}
                  subtitle={`${formatTransactionDate(transaction.date)} · ${transaction.category}`}
                  leading={
                    <IosAvatar
                      fallback={label.slice(0, 1).toUpperCase()}
                      tone={signed >= 0 ? "success" : "muted"}
                    />
                  }
                  trailing={
                    <span
                      className={cn(
                        signed >= 0 ? "text-[var(--success)]" : "text-[var(--foreground)]",
                      )}
                    >
                      {signed >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(signed))}
                    </span>
                  }
                  onClick={() => setEditTransactionId(transaction.id)}
                />
              );
            })}
          </IosList>
        )}
      </IosSection>

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
