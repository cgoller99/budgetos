/**
 * Transaction loading windows for Stage 3 performance.
 * Full history remains available via explicit pagination / reports queries.
 */

/** Default lookback for FinanceContext bootstrap and dashboard engines. */
export const FINANCE_TRANSACTION_LOOKBACK_DAYS = 120;

/** Hard cap so pathological histories cannot stall cold load. */
export const FINANCE_TRANSACTION_BOOTSTRAP_LIMIT = 2500;

/** Page size for Transactions screen incremental loads. */
export const FINANCE_TRANSACTION_PAGE_SIZE = 100;

export type TransactionsLoadMeta = {
  truncated: boolean;
  lookbackDays: number;
  limit: number;
  loadedCount: number;
  oldestLoadedDate: string | null;
  newestLoadedDate: string | null;
};

export function getTransactionLookbackStartIso(
  referenceDate = new Date(),
  lookbackDays = FINANCE_TRANSACTION_LOOKBACK_DAYS,
): string {
  const start = new Date(referenceDate);
  start.setUTCDate(start.getUTCDate() - lookbackDays);
  return start.toISOString();
}

export function buildTransactionsLoadMeta(input: {
  transactions: Array<{ date: string }>;
  truncated: boolean;
  lookbackDays?: number;
  limit?: number;
}): TransactionsLoadMeta {
  const dates = input.transactions
    .map((transaction) => transaction.date)
    .filter(Boolean)
    .sort();

  return {
    truncated: input.truncated,
    lookbackDays: input.lookbackDays ?? FINANCE_TRANSACTION_LOOKBACK_DAYS,
    limit: input.limit ?? FINANCE_TRANSACTION_BOOTSTRAP_LIMIT,
    loadedCount: input.transactions.length,
    oldestLoadedDate: dates[0] ?? null,
    newestLoadedDate: dates.at(-1) ?? null,
  };
}
