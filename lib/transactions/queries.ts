import type { FinanceData, Transaction, TransactionType } from "@/lib/finance/types";

export type TransactionSortField = "date" | "amount";
export type TransactionSortDirection = "asc" | "desc";

export type TransactionFilterState = {
  search: string;
  type: TransactionType | "all";
  category: string;
  sortField: TransactionSortField;
  sortDirection: TransactionSortDirection;
  transactionId?: string | null;
  merchant?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  filterLabel?: string | null;
};

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterState = {
  search: "",
  type: "all",
  category: "all",
  sortField: "date",
  sortDirection: "desc",
};

function getAccountName(data: FinanceData, accountId: string): string {
  return (
    data.accounts.find((account) => account.id === accountId)?.name ?? "Account"
  );
}

function matchesSearch(
  data: FinanceData,
  transaction: Transaction,
  search: string,
): boolean {
  if (!search.trim()) {
    return true;
  }

  const query = search.trim().toLowerCase();
  const accountName = getAccountName(data, transaction.accountId).toLowerCase();
  const transferName = transaction.transferAccountId
    ? getAccountName(data, transaction.transferAccountId).toLowerCase()
    : "";

  return (
    (transaction.category ?? "").toLowerCase().includes(query) ||
    (transaction.notes ?? "").toLowerCase().includes(query) ||
    accountName.includes(query) ||
    transferName.includes(query) ||
    transaction.type.includes(query)
  );
}

function matchesDateRange(
  transaction: Transaction,
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
): boolean {
  if (!dateFrom && !dateTo) {
    return true;
  }

  const transactionDate = transaction.date.slice(0, 10);

  if (dateFrom && transactionDate < dateFrom) {
    return false;
  }

  if (dateTo && transactionDate > dateTo) {
    return false;
  }

  return true;
}

function matchesAmountRange(
  transaction: Transaction,
  amountMin: number | null | undefined,
  amountMax: number | null | undefined,
): boolean {
  if (amountMin !== null && amountMin !== undefined && transaction.amount < amountMin) {
    return false;
  }

  if (amountMax !== null && amountMax !== undefined && transaction.amount > amountMax) {
    return false;
  }

  return true;
}

export function filterAndSortTransactions(
  data: FinanceData,
  filters: TransactionFilterState,
): Transaction[] {
  let results = (data.transactions ?? []).filter((transaction) => {
    if (
      filters.transactionId &&
      transaction.id !== filters.transactionId
    ) {
      return false;
    }

    if (filters.type !== "all" && transaction.type !== filters.type) {
      return false;
    }

    if (
      filters.category !== "all" &&
      (transaction.category ?? "").toLowerCase() !== filters.category.toLowerCase()
    ) {
      return false;
    }

    if (!matchesDateRange(transaction, filters.dateFrom, filters.dateTo)) {
      return false;
    }

    if (!matchesAmountRange(transaction, filters.amountMin, filters.amountMax)) {
      return false;
    }

    return matchesSearch(data, transaction, filters.search);
  });

  results = [...results].sort((left, right) => {
    if (filters.sortField === "amount") {
      return filters.sortDirection === "asc"
        ? left.amount - right.amount
        : right.amount - left.amount;
    }

    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();

    return filters.sortDirection === "asc"
      ? leftTime - rightTime
      : rightTime - leftTime;
  });

  return results;
}

export function getTransactionsForMonth(
  data: FinanceData,
  referenceDate = new Date(),
): Transaction[] {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();

  return (data.transactions ?? []).filter((transaction) => {
    const date = new Date(transaction.date);
    return date.getMonth() === month && date.getFullYear() === year;
  });
}

export function sumTransactionsByType(
  data: FinanceData,
  type: TransactionType,
  referenceDate = new Date(),
): number {
  return getTransactionsForMonth(data, referenceDate)
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

export function getTransactionSummary(data: FinanceData) {
  const currentMonth = getTransactionsForMonth(data);

  return {
    count: (data.transactions ?? []).length,
    monthCount: currentMonth.length,
    monthIncome: sumTransactionsByType(data, "income"),
    monthExpenses: sumTransactionsByType(data, "expense"),
    monthTransfers: sumTransactionsByType(data, "transfer"),
  };
}

export function formatTransactionDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getTransactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case "income":
      return "Income";
    case "expense":
      return "Expense";
    case "transfer":
      return "Transfer";
  }
}
