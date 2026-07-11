import "server-only";

import type { Transaction } from "plaid";
import { getPlaidClient, getPlaidErrorMessage } from "@/lib/plaid/plaidClient";
import { mapPlaidTransaction } from "@/lib/plaid/mappers";
import type { PlaidMappedAccount, PlaidTransactionSkipReason } from "@/lib/plaid/types";
import type { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";

const BACKFILL_LOOKBACK_DAYS = 730;

export type PlaidTransactionBackfillResult = {
  accountsRequested: number;
  externalAccountIds: string[];
  fetchedFromPlaid: number;
  inserted: number;
  updated: number;
  removed: number;
  skipped: Array<{ reason: PlaidTransactionSkipReason; count: number }>;
  error: string | null;
};

function monthsAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function fetchHistoricalPlaidTransactions(params: {
  accessToken: string;
  externalAccountIds: string[];
}): Promise<Transaction[]> {
  if (params.externalAccountIds.length === 0) {
    return [];
  }

  const client = getPlaidClient();
  const startDate = monthsAgoIso(BACKFILL_LOOKBACK_DAYS);
  const endDate = new Date().toISOString().slice(0, 10);
  const collected: Transaction[] = [];
  let offset = 0;
  const pageSize = 500;

  while (true) {
    const response = await client.transactionsGet({
      access_token: params.accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        account_ids: params.externalAccountIds,
        count: pageSize,
        offset,
        include_personal_finance_category: true,
      },
    });

    collected.push(...response.data.transactions);

    if (collected.length >= response.data.total_transactions) {
      break;
    }

    offset += pageSize;
  }

  return collected;
}

export async function backfillHistoricalTransactions(params: {
  accessToken: string;
  repository: BankConnectionsRepository;
  userId: string;
  householdId: string | null;
  accountIdMap: Map<string, string>;
  accountContextMap: Map<string, Pick<PlaidMappedAccount, "recordKind" | "type">>;
  accounts: PlaidMappedAccount[];
}): Promise<PlaidTransactionBackfillResult> {
  const externalAccountIds = params.accounts.map(
    (account) => account.externalAccountId,
  );

  const emptyResult: PlaidTransactionBackfillResult = {
    accountsRequested: params.accounts.length,
    externalAccountIds,
    fetchedFromPlaid: 0,
    inserted: 0,
    updated: 0,
    removed: 0,
    skipped: [],
    error: null,
  };

  if (externalAccountIds.length === 0) {
    return emptyResult;
  }

  try {
    const transactions = await fetchHistoricalPlaidTransactions({
      accessToken: params.accessToken,
      externalAccountIds,
    });

    const mappedTransactions = transactions.map((transaction) =>
      mapPlaidTransaction(
        transaction,
        params.accountContextMap.get(transaction.account_id),
      ),
    );

    const persistResult = await params.repository.persistSyncedTransactions({
      userId: params.userId,
      householdId: params.householdId,
      accountIdMap: params.accountIdMap,
      transactions: mappedTransactions,
      removedExternalIds: [],
    });

    console.info("[plaid/sync] historical backfill complete", {
      userId: params.userId,
      accountsRequested: params.accounts.length,
      externalAccountIds,
      fetchedFromPlaid: transactions.length,
      inserted: persistResult.added,
      updated: persistResult.modified,
      skipped: persistResult.skipped,
    });

    return {
      accountsRequested: params.accounts.length,
      externalAccountIds,
      fetchedFromPlaid: transactions.length,
      inserted: persistResult.added,
      updated: persistResult.modified,
      removed: persistResult.removed,
      skipped: persistResult.skipped,
      error: null,
    };
  } catch (error) {
    const message = getPlaidErrorMessage(error);
    console.warn("[plaid/sync] historical backfill failed", {
      userId: params.userId,
      externalAccountIds,
      message,
    });

    return {
      ...emptyResult,
      error: message,
    };
  }
}

export function selectAccountsNeedingBackfill(params: {
  mappedAccounts: PlaidMappedAccount[];
  accountIdMap: Map<string, string>;
  transactionCounts: Map<string, number>;
}): PlaidMappedAccount[] {
  return params.mappedAccounts.filter((account) => {
    const internalId = params.accountIdMap.get(account.externalAccountId);
    if (!internalId) {
      return false;
    }

    return (params.transactionCounts.get(internalId) ?? 0) === 0;
  });
}
