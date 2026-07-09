import type { TransactionType } from "@/lib/finance/types";
import {
  DEFAULT_TRANSACTION_FILTERS,
  type TransactionFilterState,
} from "@/lib/transactions/queries";

export const TRANSACTIONS_PATH = "/transactions";

function parseNumber(value: string | null): number | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseType(value: string | null): TransactionFilterState["type"] {
  if (
    value === "income" ||
    value === "expense" ||
    value === "transfer" ||
    value === "all"
  ) {
    return value;
  }

  return DEFAULT_TRANSACTION_FILTERS.type;
}

function parseSort(value: string | null): Pick<
  TransactionFilterState,
  "sortField" | "sortDirection"
> {
  if (!value) {
    return {
      sortField: DEFAULT_TRANSACTION_FILTERS.sortField,
      sortDirection: DEFAULT_TRANSACTION_FILTERS.sortDirection,
    };
  }

  const [sortField, sortDirection] = value.split(":");

  if (
    (sortField === "date" || sortField === "amount") &&
    (sortDirection === "asc" || sortDirection === "desc")
  ) {
    return { sortField, sortDirection };
  }

  return {
    sortField: DEFAULT_TRANSACTION_FILTERS.sortField,
    sortDirection: DEFAULT_TRANSACTION_FILTERS.sortDirection,
  };
}

export function parseTransactionFilters(
  searchParams: URLSearchParams,
): TransactionFilterState {
  const merchant = searchParams.get("merchant")?.trim() ?? "";
  const search =
    searchParams.get("search")?.trim() ||
    merchant ||
    DEFAULT_TRANSACTION_FILTERS.search;
  const sort = parseSort(searchParams.get("sort"));

  return {
    search,
    type: parseType(searchParams.get("type")),
    category: searchParams.get("category")?.trim() || DEFAULT_TRANSACTION_FILTERS.category,
    sortField: sort.sortField,
    sortDirection: sort.sortDirection,
    transactionId: searchParams.get("transactionId")?.trim() || null,
    merchant: merchant || null,
    dateFrom: searchParams.get("dateFrom")?.trim() || null,
    dateTo: searchParams.get("dateTo")?.trim() || null,
    amountMin: parseNumber(searchParams.get("amountMin")),
    amountMax: parseNumber(searchParams.get("amountMax")),
    filterLabel: searchParams.get("label")?.trim() || null,
  };
}

export function serializeTransactionFilters(
  filters: TransactionFilterState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.transactionId) {
    params.set("transactionId", filters.transactionId);
  }

  if (filters.merchant) {
    params.set("merchant", filters.merchant);
  } else if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.type !== DEFAULT_TRANSACTION_FILTERS.type) {
    params.set("type", filters.type);
  }

  if (filters.category !== DEFAULT_TRANSACTION_FILTERS.category) {
    params.set("category", filters.category);
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  if (filters.amountMin !== null && filters.amountMin !== undefined) {
    params.set("amountMin", String(filters.amountMin));
  }

  if (filters.amountMax !== null && filters.amountMax !== undefined) {
    params.set("amountMax", String(filters.amountMax));
  }

  if (filters.filterLabel) {
    params.set("label", filters.filterLabel);
  }

  const sortValue = `${filters.sortField}:${filters.sortDirection}`;
  const defaultSort = `${DEFAULT_TRANSACTION_FILTERS.sortField}:${DEFAULT_TRANSACTION_FILTERS.sortDirection}`;

  if (sortValue !== defaultSort) {
    params.set("sort", sortValue);
  }

  return params;
}

export function buildTransactionsHref(
  filters: Partial<TransactionFilterState>,
): string {
  const merged: TransactionFilterState = {
    ...DEFAULT_TRANSACTION_FILTERS,
    ...filters,
  };
  const query = serializeTransactionFilters(merged).toString();
  return query ? `${TRANSACTIONS_PATH}?${query}` : TRANSACTIONS_PATH;
}

export function getCurrentMonthDateRange(referenceDate = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const dateFrom = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);
  const dateTo = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
  )
    .toISOString()
    .slice(0, 10);

  return { dateFrom, dateTo };
}

export function getMoneyFlowStageHref(
  stageId: string,
  referenceDate = new Date(),
): string {
  const { dateFrom, dateTo } = getCurrentMonthDateRange(referenceDate);

  switch (stageId) {
    case "income":
      return buildTransactionsHref({
        type: "income",
        dateFrom,
        dateTo,
        filterLabel: "Monthly income",
      });
    case "bills":
      return buildTransactionsHref({
        type: "expense",
        dateFrom,
        dateTo,
        filterLabel: "Monthly bills & spending",
      });
    case "debts":
      return buildTransactionsHref({
        type: "expense",
        search: "debt",
        dateFrom,
        dateTo,
        filterLabel: "Debt payments",
      });
    case "goals":
      return buildTransactionsHref({
        type: "expense",
        category: "Savings",
        dateFrom,
        dateTo,
        filterLabel: "Goal contributions",
      });
    case "investments":
      return buildTransactionsHref({
        type: "expense",
        category: "Investment",
        dateFrom,
        dateTo,
        filterLabel: "Investment activity",
      });
    case "safeToSpend":
      return buildTransactionsHref({
        type: "expense",
        dateFrom,
        dateTo,
        filterLabel: "Recent spending",
      });
    default:
      return TRANSACTIONS_PATH;
  }
}

export function describeTransactionFilters(
  filters: TransactionFilterState,
): string {
  if (filters.filterLabel) {
    return filters.filterLabel;
  }

  const parts: string[] = [];

  if (filters.transactionId) {
    parts.push("selected transaction");
  }

  if (filters.merchant) {
    parts.push(filters.merchant);
  } else if (filters.search.trim()) {
    parts.push(filters.search.trim());
  }

  if (filters.type !== "all") {
    parts.push(filters.type);
  }

  if (filters.category !== "all") {
    parts.push(filters.category);
  }

  if (filters.dateFrom || filters.dateTo) {
    parts.push(
      [filters.dateFrom, filters.dateTo].filter(Boolean).join(" – "),
    );
  }

  return parts.length > 0 ? parts.join(" · ") : "filtered view";
}

export type { TransactionType };
