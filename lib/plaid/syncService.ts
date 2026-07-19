import "server-only";

import type { Transaction } from "plaid";
import {
  getPlaidClient,
  getPlaidErrorMessage,
  isPlaidItemLoginRequired,
  isPlaidTransactionsPendingError,
  PLAID_COUNTRY_CODES,
} from "@/lib/plaid/plaidClient";
import {
  detectPlaidPayrollCandidates,
  detectPlaidRecurringCandidates,
  mapPlaidAccount,
  mapPlaidTransaction,
  summarizePlaidAccountMapping,
} from "@/lib/plaid/mappers";
import { decryptConnectionAccessToken } from "@/lib/plaid/plaidService";
import {
  backfillHistoricalTransactions,
  selectAccountsNeedingBackfill,
  type PlaidTransactionBackfillResult,
} from "@/lib/plaid/transactionBackfill";
import type {
  PlaidMappedAccount,
  PlaidMappedTransaction,
  PlaidPayrollCandidate,
  PlaidRecurringCandidate,
  PlaidSyncDiagnostics,
  PlaidSyncResult,
} from "@/lib/plaid/types";
import type { BankConnectionRow } from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";
import { resolveUserHouseholdId } from "@/lib/supabase/householdFinance";
import { reconcileBillPaymentsForUser } from "@/lib/bills/persistBillReconciliation";

const INITIAL_SYNC_LOOKBACK_DAYS = 730;
const SYNC_RETRY_DELAY_MS = 2500;
const MAX_SYNC_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function requestTransactionsRefresh(accessToken: string): Promise<boolean> {
  try {
    const client = getPlaidClient();
    await client.transactionsRefresh({ access_token: accessToken });
    return true;
  } catch (error) {
    console.warn("[plaid/sync] transactionsRefresh failed", {
      message: getPlaidErrorMessage(error),
    });
    return false;
  }
}

async function resolveInstitutionName(params: {
  connection: BankConnectionRow;
  itemInstitutionId: string | null;
}): Promise<string> {
  if (
    params.connection.institution_name &&
    !params.connection.institution_name.startsWith("ins_")
  ) {
    return params.connection.institution_name;
  }

  const institutionId =
    params.connection.institution_id ?? params.itemInstitutionId ?? null;

  if (!institutionId) {
    return "Linked institution";
  }

  try {
    const client = getPlaidClient();
    const response = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [...PLAID_COUNTRY_CODES],
    });

    return response.data.institution.name;
  } catch (error) {
    console.warn("[plaid/sync] institution name lookup failed", {
      institutionId,
      message: getPlaidErrorMessage(error),
    });
    return "Linked institution";
  }
}

function buildAccountContextMap(
  accounts: PlaidMappedAccount[],
): Map<string, Pick<PlaidMappedAccount, "recordKind" | "type">> {
  return new Map(
    accounts.map((account) => [
      account.externalAccountId,
      { recordKind: account.recordKind, type: account.type },
    ]),
  );
}

function mapSyncTransactions(
  transactions: Transaction[],
  accountContextMap: Map<string, Pick<PlaidMappedAccount, "recordKind" | "type">>,
): PlaidMappedTransaction[] {
  return transactions.map((transaction) =>
    mapPlaidTransaction(
      transaction,
      accountContextMap.get(transaction.account_id),
    ),
  );
}

async function syncPlaidTransactionsOnce(params: {
  accessToken: string;
  connection: BankConnectionRow;
  repository: BankConnectionsRepository;
  userId: string;
  householdId: string | null;
  accountIdMap: Map<string, string>;
  accountContextMap: Map<string, Pick<PlaidMappedAccount, "recordKind" | "type">>;
  primeInitialWindow: boolean;
}): Promise<{
  added: number;
  modified: number;
  removed: number;
  skipped: PlaidSyncDiagnostics["persisted"]["skipped"];
  nextCursor: string | null;
  pendingError: string | null;
  fetchedFromPlaid: number;
  addedFromPlaid: number;
  modifiedFromPlaid: number;
  removedFromPlaid: number;
}> {
  const {
    accessToken,
    connection,
    repository,
    userId,
    householdId,
    accountIdMap,
    accountContextMap,
    primeInitialWindow,
  } = params;

  try {
    if (primeInitialWindow) {
      await ensureInitialSyncWindow(accessToken);
    }

    const syncResult = await fetchAllSyncTransactions({
      accessToken,
      cursor: connection.transactions_cursor,
    });

    const mappedTransactions = mapSyncTransactions(
      [...syncResult.added, ...syncResult.modified],
      accountContextMap,
    );

    const persistResult = await repository.persistSyncedTransactions({
      userId,
      householdId,
      accountIdMap,
      transactions: mappedTransactions,
      removedExternalIds: syncResult.removed,
    });

    return {
      added: persistResult.added,
      modified: persistResult.modified,
      removed: persistResult.removed,
      skipped: persistResult.skipped,
      nextCursor: syncResult.nextCursor,
      pendingError: null,
      fetchedFromPlaid: syncResult.added.length + syncResult.modified.length,
      addedFromPlaid: syncResult.added.length,
      modifiedFromPlaid: syncResult.modified.length,
      removedFromPlaid: syncResult.removed.length,
    };
  } catch (error) {
    if (isPlaidItemLoginRequired(error)) {
      throw error;
    }

    const message = getPlaidErrorMessage(error);

    console.warn("[plaid/sync] transaction sync deferred", {
      connectionId: connection.id,
      pending: isPlaidTransactionsPendingError(error),
      message,
    });

    return {
      added: 0,
      modified: 0,
      removed: 0,
      skipped: [],
      nextCursor: connection.transactions_cursor,
      pendingError: message,
      fetchedFromPlaid: 0,
      addedFromPlaid: 0,
      modifiedFromPlaid: 0,
      removedFromPlaid: 0,
    };
  }
}

async function syncPlaidTransactions(params: {
  accessToken: string;
  connection: BankConnectionRow;
  repository: BankConnectionsRepository;
  userId: string;
  householdId: string | null;
  accountIdMap: Map<string, string>;
  accountContextMap: Map<string, Pick<PlaidMappedAccount, "recordKind" | "type">>;
  newAccountExternalIds: string[];
}): Promise<{
  added: number;
  modified: number;
  removed: number;
  skipped: PlaidSyncDiagnostics["persisted"]["skipped"];
  nextCursor: string | null;
  pendingError: string | null;
  refreshRequested: boolean;
  syncAttempts: number;
  fetchedFromPlaid: number;
  addedFromPlaid: number;
  modifiedFromPlaid: number;
  removedFromPlaid: number;
}> {
  const shouldPrimeInitialWindow = !params.connection.transactions_cursor;
  const shouldForceRefresh =
    params.newAccountExternalIds.length > 0 || shouldPrimeInitialWindow;

  let refreshRequested = false;

  if (shouldForceRefresh) {
    refreshRequested = await requestTransactionsRefresh(params.accessToken);
    if (refreshRequested) {
      await sleep(SYNC_RETRY_DELAY_MS);
    }
  }

  let latest = await syncPlaidTransactionsOnce({
    ...params,
    primeInitialWindow: shouldPrimeInitialWindow,
  });

  let syncAttempts = 1;

  const needsRetry = () =>
    Boolean(latest.pendingError) ||
    (shouldForceRefresh &&
      latest.fetchedFromPlaid === 0 &&
      latest.added === 0 &&
      latest.modified === 0);

  while (needsRetry() && syncAttempts < MAX_SYNC_ATTEMPTS) {
    syncAttempts += 1;
    refreshRequested =
      (await requestTransactionsRefresh(params.accessToken)) || refreshRequested;
    await sleep(SYNC_RETRY_DELAY_MS * syncAttempts);
    latest = await syncPlaidTransactionsOnce({
      ...params,
      primeInitialWindow: false,
    });
  }

  return {
    added: latest.added,
    modified: latest.modified,
    removed: latest.removed,
    skipped: latest.skipped,
    nextCursor: latest.nextCursor,
    pendingError: latest.pendingError,
    refreshRequested,
    syncAttempts,
    fetchedFromPlaid: latest.fetchedFromPlaid,
    addedFromPlaid: latest.addedFromPlaid,
    modifiedFromPlaid: latest.modifiedFromPlaid,
    removedFromPlaid: latest.removedFromPlaid,
  };
}

function buildSyncDiagnostics(params: {
  connectionId: string;
  itemId: string;
  mappedAccounts: PlaidMappedAccount[];
  accountIdMap: Map<string, string>;
  insertedExternalIds: string[];
  transactionResult: Awaited<ReturnType<typeof syncPlaidTransactions>>;
  transactionCounts: Map<string, number>;
  backfillResult: PlaidTransactionBackfillResult | null;
}): PlaidSyncDiagnostics {
  const inserted = new Set(params.insertedExternalIds);

  return {
    connectionId: params.connectionId,
    itemId: params.itemId,
    accounts: params.mappedAccounts.map((account) => ({
      externalAccountId: account.externalAccountId,
      internalAccountId:
        params.accountIdMap.get(account.externalAccountId) ?? "",
      name: account.name,
      recordKind: account.recordKind,
      type: account.type,
      lastFour: account.lastFour,
      balance: account.balance,
      institution: account.institution,
      isNew: inserted.has(account.externalAccountId),
    })),
    plaid: {
      fetchedFromPlaid: params.transactionResult.fetchedFromPlaid,
      addedFromPlaid: params.transactionResult.addedFromPlaid,
      modifiedFromPlaid: params.transactionResult.modifiedFromPlaid,
      removedFromPlaid: params.transactionResult.removedFromPlaid,
      pending: Boolean(params.transactionResult.pendingError),
      pendingError: params.transactionResult.pendingError,
      refreshRequested: params.transactionResult.refreshRequested,
      syncAttempts: params.transactionResult.syncAttempts,
    },
    persisted: {
      inserted: params.transactionResult.added,
      updated: params.transactionResult.modified,
      deleted: params.transactionResult.removed,
      skipped: params.transactionResult.skipped,
    },
    database: {
      transactionCountByAccountId: Object.fromEntries(params.transactionCounts),
    },
    backfill: params.backfillResult
      ? {
          accountsRequested: params.backfillResult.accountsRequested,
          fetchedFromPlaid: params.backfillResult.fetchedFromPlaid,
          inserted: params.backfillResult.inserted,
          updated: params.backfillResult.updated,
          skipped: params.backfillResult.skipped,
          error: params.backfillResult.error,
        }
      : undefined,
  };
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
    const priorExternalAccountIds =
      await repository.listExternalAccountIdsForConnection(userId, connection.id);
    const accountsResponse = await client.accountsGet({ access_token: accessToken });
    const itemId = accountsResponse.data.item.item_id;
    const institutionName = await resolveInstitutionName({
      connection,
      itemInstitutionId: accountsResponse.data.item.institution_id ?? null,
    });
    const institutionLogoUrl = connection.institution_logo_url;

    const mappedAccounts = accountsResponse.data.accounts.map((account) =>
      mapPlaidAccount({
        account,
        itemId,
        institutionName,
        institutionLogoUrl,
      }),
    );

    console.info("[plaid/sync] mapped accounts", {
      connectionId: connection.id,
      userId,
      institutionName,
      accounts: mappedAccounts.map((account) => ({
        externalAccountId: account.externalAccountId,
        name: account.name,
        type: account.type,
        recordKind: account.recordKind,
        balance: account.balance,
        lastFour: account.lastFour,
      })),
    });

    summarizePlaidAccountMapping({
      userId,
      connectionId: connection.id,
      itemId,
      accounts: mappedAccounts,
    });

    await repository.syncConnectionHousehold({
      connectionId: connection.id,
      userId,
      householdId,
      institutionName,
    });

    const { accountIdMap, insertedExternalIds } =
      await repository.upsertLinkedAccounts({
        userId,
        householdId,
        connectionId: connection.id,
        accounts: mappedAccounts,
      });

    const newAccountExternalIds = mappedAccounts
      .map((account) => account.externalAccountId)
      .filter((externalAccountId) => !priorExternalAccountIds.has(externalAccountId));

    const accountContextMap = buildAccountContextMap(mappedAccounts);

    const transactionResult = await syncPlaidTransactions({
      accessToken,
      connection,
      repository,
      userId,
      householdId,
      accountIdMap,
      accountContextMap,
      newAccountExternalIds,
    });

    let transactionCounts = await repository.countTransactionsByAccountIds(
      userId,
      [...accountIdMap.values()],
    );

    let backfillResult: PlaidTransactionBackfillResult | null = null;
    const accountsNeedingBackfill = selectAccountsNeedingBackfill({
      mappedAccounts,
      accountIdMap,
      transactionCounts,
    });

    if (accountsNeedingBackfill.length > 0) {
      console.info("[plaid/sync] backfilling accounts with zero persisted transactions", {
        connectionId: connection.id,
        userId,
        accounts: accountsNeedingBackfill.map((account) => ({
          externalAccountId: account.externalAccountId,
          name: account.name,
          type: account.type,
          recordKind: account.recordKind,
          lastFour: account.lastFour ? `****${account.lastFour}` : null,
        })),
      });

      await requestTransactionsRefresh(accessToken);
      await sleep(SYNC_RETRY_DELAY_MS);

      backfillResult = await backfillHistoricalTransactions({
        accessToken,
        repository,
        userId,
        householdId,
        accountIdMap,
        accountContextMap,
        accounts: accountsNeedingBackfill,
      });

      transactionResult.added += backfillResult.inserted;
      transactionResult.modified += backfillResult.updated;

      transactionCounts = await repository.countTransactionsByAccountIds(
        userId,
        [...accountIdMap.values()],
      );
    }

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
    } catch (error) {
      console.warn("[plaid/sync] investments sync skipped", {
        connectionId: connection.id,
        message: getPlaidErrorMessage(error),
      });
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
    } catch (error) {
      console.warn("[plaid/sync] liabilities sync skipped", {
        connectionId: connection.id,
        message: getPlaidErrorMessage(error),
      });
    }

    const transactionCountsForDiagnostics = transactionCounts;

    const diagnostics = buildSyncDiagnostics({
      connectionId: connection.id,
      itemId,
      mappedAccounts,
      accountIdMap,
      insertedExternalIds,
      transactionResult,
      transactionCounts: transactionCountsForDiagnostics,
      backfillResult,
    });

    const newCreditAccountsWithoutTransactions = diagnostics.accounts.filter(
      (account) =>
        account.recordKind === "debt" &&
        account.type === "credit_card" &&
        (transactionCountsForDiagnostics.get(account.internalAccountId) ?? 0) === 0,
    );

    if (newCreditAccountsWithoutTransactions.length > 0) {
      console.warn("[plaid/sync] credit accounts still have zero transactions after backfill", {
        connectionId: connection.id,
        userId,
        accounts: newCreditAccountsWithoutTransactions.map((account) => ({
          externalAccountId: account.externalAccountId,
          name: account.name,
          lastFour: account.lastFour ? `****${account.lastFour}` : null,
        })),
        pendingError: transactionResult.pendingError,
        backfillError: backfillResult?.error ?? null,
        backfillFetched: backfillResult?.fetchedFromPlaid ?? 0,
      });
    }

    try {
      const reconciliation = await reconcileBillPaymentsForUser(supabase, userId);
      console.info("[plaid/sync] bill payment reconciliation", {
        connectionId: connection.id,
        userId,
        transactionsLinked: reconciliation.reconcile.transactionsLinked,
        billsUpdated: reconciliation.reconcile.billsUpdated.length,
      });
    } catch (reconcileError) {
      console.warn("[plaid/sync] bill payment reconciliation failed", {
        connectionId: connection.id,
        userId,
        message:
          reconcileError instanceof Error
            ? reconcileError.message
            : String(reconcileError),
      });
    }

    await repository.markConnectionSynced({
      connectionId: connection.id,
      userId,
      transactionsCursor: transactionResult.nextCursor,
      status: "connected",
      errorCode:
        newCreditAccountsWithoutTransactions.length > 0
          ? "TRANSACTIONS_PENDING"
          : transactionResult.pendingError
            ? "TRANSACTIONS_PENDING"
            : null,
      errorMessage:
        newCreditAccountsWithoutTransactions.length > 0
          ? "Credit card transactions are still syncing. Tap Sync now again in a minute."
          : transactionResult.pendingError,
    });

    console.info("[plaid/sync] connection synced", {
      connectionId: connection.id,
      accountsSynced: mappedAccounts.length,
      newAccounts: newAccountExternalIds.length,
      transactionsAdded: transactionResult.added,
      transactionsModified: transactionResult.modified,
      syncAttempts: transactionResult.syncAttempts,
      refreshRequested: transactionResult.refreshRequested,
      diagnostics,
    });

    return {
      connectionId: connection.id,
      accountsSynced: mappedAccounts.length,
      transactionsAdded: transactionResult.added,
      transactionsModified: transactionResult.modified,
      transactionsRemoved: transactionResult.removed,
      investmentsSynced,
      liabilitiesSynced,
      diagnostics,
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
