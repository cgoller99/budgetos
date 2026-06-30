import "server-only";

import type { Transaction } from "plaid";
import {
  getPlaidClient,
  getPlaidErrorMessage,
  isPlaidItemLoginRequired,
} from "@/lib/plaid/plaidClient";
import {
  detectPlaidPayrollCandidates,
  detectPlaidRecurringCandidates,
  mapPlaidAccount,
  mapPlaidTransaction,
} from "@/lib/plaid/mappers";
import { decryptConnectionAccessToken } from "@/lib/plaid/plaidService";
import type {
  PlaidMappedTransaction,
  PlaidPayrollCandidate,
  PlaidRecurringCandidate,
  PlaidSyncResult,
} from "@/lib/plaid/types";
import type { BankConnectionRow } from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";
import { resolveUserHouseholdId } from "@/lib/supabase/householdFinance";

const INITIAL_SYNC_LOOKBACK_DAYS = 730;

function monthsAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function fetchAllSyncTransactions(params: {
  accessToken: string;
  cursor?: string | null;
}): Promise<{
  added: Transaction[];
  modified: Transaction[];
  removed: string[];
  nextCursor: string | null;
}> {
  const client = getPlaidClient();
  let cursor = params.cursor ?? undefined;
  let hasMore = true;
  const added: Transaction[] = [];
  const modified: Transaction[] = [];
  const removed: string[] = [];

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: params.accessToken,
      cursor,
      count: 500,
    });

    added.push(...response.data.added);
    modified.push(...response.data.modified);
    removed.push(...response.data.removed.map((item) => item.transaction_id));
    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  return {
    added,
    modified,
    removed,
    nextCursor: cursor ?? null,
  };
}

async function ensureInitialSyncWindow(accessToken: string): Promise<void> {
  const client = getPlaidClient();
  const startDate = monthsAgoIso(INITIAL_SYNC_LOOKBACK_DAYS);
  const endDate = new Date().toISOString().slice(0, 10);

  await client.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
    options: { count: 1, offset: 0 },
  });
}

export async function syncPlaidConnection(params: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  connection: BankConnectionRow;
}): Promise<PlaidSyncResult> {
  const { supabase, userId, connection } = params;
  const repository = new BankConnectionsRepository(supabase);
  const householdId = await resolveUserHouseholdId(supabase, userId);
  const accessToken = decryptConnectionAccessToken(connection);

  try {
    const client = getPlaidClient();
    const accountsResponse = await client.accountsGet({ access_token: accessToken });
    const itemId = accountsResponse.data.item.item_id;
    const institutionName =
      connection.institution_name ??
      accountsResponse.data.item.institution_id ??
      "Linked institution";
    const institutionLogoUrl = connection.institution_logo_url;

    const mappedAccounts = accountsResponse.data.accounts.map((account) =>
      mapPlaidAccount({
        account,
        itemId,
        institutionName,
        institutionLogoUrl,
      }),
    );

    const accountIdMap = await repository.upsertLinkedAccounts({
      userId,
      householdId,
      connectionId: connection.id,
      accounts: mappedAccounts,
    });

    if (!connection.transactions_cursor) {
      await ensureInitialSyncWindow(accessToken);
    }

    const syncResult = await fetchAllSyncTransactions({
      accessToken,
      cursor: connection.transactions_cursor,
    });

    const mappedTransactions = [...syncResult.added, ...syncResult.modified].map(
      mapPlaidTransaction,
    );

    const persistResult = await repository.persistSyncedTransactions({
      userId,
      householdId,
      accountIdMap,
      transactions: mappedTransactions,
      removedExternalIds: syncResult.removed,
    });

    let investmentsSynced = 0;
    let liabilitiesSynced = 0;

    try {
      const investmentsResponse = await client.investmentsHoldingsGet({
        access_token: accessToken,
      });

      investmentsSynced = investmentsResponse.data.accounts.length;
      await repository.upsertInvestmentHoldings({
        userId,
        householdId,
        connectionId: connection.id,
        itemId,
        institutionName,
        institutionLogoUrl,
        accounts: investmentsResponse.data.accounts,
        holdings: investmentsResponse.data.holdings,
        securities: investmentsResponse.data.securities,
      });
    } catch {
      // Investments may not be available for every institution.
    }

    try {
      const liabilitiesResponse = await client.liabilitiesGet({
        access_token: accessToken,
      });

      liabilitiesSynced =
        (liabilitiesResponse.data.liabilities.credit?.length ?? 0) +
        (liabilitiesResponse.data.liabilities.mortgage?.length ?? 0) +
        (liabilitiesResponse.data.liabilities.student?.length ?? 0);

      await repository.upsertLiabilities({
        userId,
        householdId,
        connectionId: connection.id,
        itemId,
        institutionName,
        institutionLogoUrl,
        liabilities: liabilitiesResponse.data.liabilities,
        accounts: liabilitiesResponse.data.accounts,
      });
    } catch {
      // Liabilities may not be available for every institution.
    }

    await repository.markConnectionSynced({
      connectionId: connection.id,
      userId,
      transactionsCursor: syncResult.nextCursor,
      status: "connected",
      errorCode: null,
      errorMessage: null,
    });

    return {
      connectionId: connection.id,
      accountsSynced: mappedAccounts.length,
      transactionsAdded: persistResult.added,
      transactionsModified: persistResult.modified,
      transactionsRemoved: persistResult.removed,
      investmentsSynced,
      liabilitiesSynced,
    };
  } catch (error) {
    const message = getPlaidErrorMessage(error);
    const status = isPlaidItemLoginRequired(error) ? "error" : "error";

    await repository.markConnectionSynced({
      connectionId: connection.id,
      userId,
      transactionsCursor: connection.transactions_cursor,
      status,
      errorCode: isPlaidItemLoginRequired(error) ? "ITEM_LOGIN_REQUIRED" : "SYNC_FAILED",
      errorMessage: message,
    });

    throw error;
  }
}

export async function syncPlaidForUser(params: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  connectionId?: string;
}): Promise<PlaidSyncResult[]> {
  const repository = new BankConnectionsRepository(params.supabase);
  const connections = params.connectionId
    ? [
        await repository.getConnectionById(params.userId, params.connectionId),
      ].filter((value): value is BankConnectionRow => Boolean(value))
    : await repository.listConnections(params.userId);

  const activeConnections = connections.filter(
    (connection) => connection.status !== "disconnected",
  );

  const results: PlaidSyncResult[] = [];

  for (const connection of activeConnections) {
    results.push(
      await syncPlaidConnection({
        supabase: params.supabase,
        userId: params.userId,
        connection,
      }),
    );
  }

  return results;
}

export function detectRecurringBillCandidatesFromTransactions(
  transactions: PlaidMappedTransaction[],
  dismissedMerchantKeys: string[],
): PlaidRecurringCandidate[] {
  const dismissed = new Set(dismissedMerchantKeys.map((key) => key.toLowerCase()));

  return detectPlaidRecurringCandidates(transactions).filter(
    (candidate) => !dismissed.has(candidate.merchantKey.toLowerCase()),
  );
}

export function detectIncomePlanPayrollCandidates(params: {
  transactions: PlaidMappedTransaction[];
  paycheckAmount: number;
  depositAccountExternalId?: string | null;
}): PlaidPayrollCandidate[] {
  return detectPlaidPayrollCandidates(params);
}
