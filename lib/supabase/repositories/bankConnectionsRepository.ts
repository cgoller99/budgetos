import type {
  AccountBase,
  Holding,
  LiabilitiesObject,
  Security,
  InvestmentAccount,
} from "plaid";
import type { BankConnection, BankConnectionStatus } from "@/lib/finance/types";
import type { PlaidMappedAccount, PlaidMappedTransaction, PlaidTransactionSkipReason } from "@/lib/plaid/types";
import type {
  BankConnectionInsert,
  BankConnectionRow,
  Database,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { mapPlaidAccount } from "@/lib/plaid/mappers";

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function dueDayFromIsoDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const day = new Date(value).getUTCDate();

  if (Number.isNaN(day) || day < 1 || day > 31) {
    return null;
  }

  return day;
}

export function mapBankConnectionRow(row: BankConnectionRow): BankConnection {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status as BankConnectionStatus,
    institutionName: row.institution_name,
    institutionLogoUrl: row.institution_logo_url,
    institutionId: row.institution_id,
    externalItemId: row.external_item_id,
    lastSyncedAt: row.last_synced_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  };
}

export class BankConnectionsRepository {
  constructor(private readonly supabase: BuxmeSupabaseClient) {}

  async listConnections(userId: string): Promise<BankConnectionRow[]> {
    const { data, error } = await this.supabase
      .from("bank_connections")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getConnectionById(
    userId: string,
    connectionId: string,
  ): Promise<BankConnectionRow | null> {
    const { data, error } = await this.supabase
      .from("bank_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async getConnectionByItemId(
    userId: string,
    itemId: string,
  ): Promise<BankConnectionRow | null> {
    const { data, error } = await this.supabase
      .from("bank_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("external_item_id", itemId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async createConnection(input: {
    userId: string;
    householdId: string | null;
    itemId: string;
    institutionName: string | null;
    institutionId: string | null;
    institutionLogoUrl?: string | null;
    encryptedToken: {
      ciphertext: string;
      iv: string;
      tag: string;
    };
  }): Promise<BankConnectionRow> {
    const payload: BankConnectionInsert = {
      user_id: input.userId,
      household_id: input.householdId,
      provider: "plaid",
      status: "connected",
      institution_name: input.institutionName,
      institution_id: input.institutionId,
      institution_logo_url: input.institutionLogoUrl ?? null,
      external_item_id: input.itemId,
      access_token_encrypted: input.encryptedToken.ciphertext,
      access_token_iv: input.encryptedToken.iv,
      access_token_tag: input.encryptedToken.tag,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from("bank_connections")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateConnectionTokens(input: {
    connectionId: string;
    userId: string;
    encryptedToken: {
      ciphertext: string;
      iv: string;
      tag: string;
    };
    institutionName?: string | null;
    institutionId?: string | null;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("bank_connections")
      .update({
        access_token_encrypted: input.encryptedToken.ciphertext,
        access_token_iv: input.encryptedToken.iv,
        access_token_tag: input.encryptedToken.tag,
        institution_name: input.institutionName,
        institution_id: input.institutionId,
        status: "connected",
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.connectionId)
      .eq("user_id", input.userId);

    if (error) {
      throw error;
    }
  }

  async markConnectionSynced(input: {
    connectionId: string;
    userId: string;
    transactionsCursor: string | null;
    status: BankConnectionStatus;
    errorCode: string | null;
    errorMessage: string | null;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("bank_connections")
      .update({
        transactions_cursor: input.transactionsCursor,
        status: input.status,
        error_code: input.errorCode,
        error_message: input.errorMessage,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.connectionId)
      .eq("user_id", input.userId);

    if (error) {
      throw error;
    }
  }

  async syncConnectionHousehold(input: {
    connectionId: string;
    userId: string;
    householdId: string | null;
    institutionName?: string | null;
  }): Promise<void> {
    const payload: {
      household_id: string | null;
      updated_at: string;
      institution_name?: string | null;
    } = {
      household_id: input.householdId,
      updated_at: new Date().toISOString(),
    };

    if (input.institutionName && !input.institutionName.startsWith("ins_")) {
      payload.institution_name = input.institutionName;
    }

    const { error } = await this.supabase
      .from("bank_connections")
      .update(payload)
      .eq("id", input.connectionId)
      .eq("user_id", input.userId);

    if (error) {
      throw error;
    }
  }

  async disconnectConnection(connectionId: string, userId: string): Promise<void> {
    const timestamp = new Date().toISOString();

    const { error: connectionError } = await this.supabase
      .from("bank_connections")
      .update({
        status: "disconnected",
        access_token_encrypted: null,
        access_token_iv: null,
        access_token_tag: null,
        updated_at: timestamp,
      })
      .eq("id", connectionId)
      .eq("user_id", userId);

    if (connectionError) {
      throw connectionError;
    }

    await this.supabase
      .from("accounts")
      .update({
        bank_connection_id: null,
        updated_at: timestamp,
      })
      .eq("bank_connection_id", connectionId)
      .eq("user_id", userId);

    await this.supabase
      .from("investments")
      .update({
        bank_connection_id: null,
        updated_at: timestamp,
      })
      .eq("bank_connection_id", connectionId)
      .eq("user_id", userId);
  }

  async removeConnectionAccounts(
    connectionId: string,
    userId: string,
  ): Promise<string[]> {
    const { data: accountRows, error: listError } = await this.supabase
      .from("accounts")
      .select("id")
      .eq("bank_connection_id", connectionId)
      .eq("user_id", userId)
      .eq("record_kind", "account");

    if (listError) {
      throw listError;
    }

    const accountIds = (accountRows ?? []).map((row) => row.id);
    const timestamp = new Date().toISOString();

    const { error: accountsError } = await this.supabase
      .from("accounts")
      .delete()
      .eq("bank_connection_id", connectionId)
      .eq("user_id", userId)
      .eq("record_kind", "account");

    if (accountsError) {
      throw accountsError;
    }

    await this.supabase
      .from("investments")
      .delete()
      .eq("bank_connection_id", connectionId)
      .eq("user_id", userId);

    await this.supabase
      .from("bank_connections")
      .update({
        status: "disconnected",
        access_token_encrypted: null,
        access_token_iv: null,
        access_token_tag: null,
        updated_at: timestamp,
      })
      .eq("id", connectionId)
      .eq("user_id", userId);

    return accountIds;
  }

  async listExternalAccountIdsForConnection(
    userId: string,
    connectionId: string,
  ): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("accounts")
      .select("external_account_id")
      .eq("user_id", userId)
      .eq("bank_connection_id", connectionId)
      .not("external_account_id", "is", null);

    if (error) {
      throw error;
    }

    return new Set(
      (data ?? [])
        .map((row) => row.external_account_id)
        .filter((value): value is string => Boolean(value)),
    );
  }

  async countTransactionsByAccountIds(
    userId: string,
    accountIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    for (const accountId of accountIds) {
      counts.set(accountId, 0);
    }

    if (accountIds.length === 0) {
      return counts;
    }

    const { data, error } = await this.supabase
      .from("transactions")
      .select("account_id")
      .eq("user_id", userId)
      .in("account_id", accountIds);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      if (!row.account_id) {
        continue;
      }

      counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
    }

    return counts;
  }

  async upsertLinkedAccounts(input: {
    userId: string;
    householdId: string | null;
    connectionId: string;
    accounts: PlaidMappedAccount[];
  }): Promise<{
    accountIdMap: Map<string, string>;
    insertedExternalIds: string[];
    updatedExternalIds: string[];
  }> {
    const accountIdMap = new Map<string, string>();
    const insertedExternalIds: string[] = [];
    const updatedExternalIds: string[] = [];
    const timestamp = new Date().toISOString();
    let inserted = 0;
    let updated = 0;

    for (const account of input.accounts) {
      const { data: existing, error: existingError } = await this.supabase
        .from("accounts")
        .select(
          "id, original_balance, monthly_change, interest_rate, minimum_payment, due_day, bank_connection_id",
        )
        .eq("user_id", input.userId)
        .eq("external_account_id", account.externalAccountId)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      const payload = {
        user_id: input.userId,
        household_id: input.householdId,
        record_kind: account.recordKind,
        name: account.name,
        institution: account.institution,
        type: account.type,
        balance: account.balance,
        bank_connection_id: input.connectionId,
        external_account_id: account.externalAccountId,
        external_item_id: account.externalItemId,
        institution_logo_url: account.institutionLogoUrl,
        available_balance: account.availableBalance,
        last_four: account.lastFour,
        last_synced_at: timestamp,
        interest_rate: account.interestRate ?? null,
        minimum_payment: account.minimumPayment ?? null,
        due_day: account.dueDay ?? null,
        updated_at: timestamp,
      };

      if (existing?.id) {
        const { error } = await this.supabase
          .from("accounts")
          .update({
            ...payload,
            monthly_change: existing.monthly_change ?? 0,
            original_balance:
              existing.original_balance ??
              account.originalBalance ??
              account.balance,
            interest_rate:
              account.interestRate ??
              existing.interest_rate ??
              null,
            minimum_payment:
              account.minimumPayment ??
              existing.minimum_payment ??
              null,
            due_day: account.dueDay ?? existing.due_day ?? 1,
          })
          .eq("id", existing.id)
          .eq("user_id", input.userId);

        if (error) {
          throw error;
        }

        accountIdMap.set(account.externalAccountId, existing.id);
        updatedExternalIds.push(account.externalAccountId);
        updated += 1;
        continue;
      }

      const { data: created, error } = await this.supabase
        .from("accounts")
        .insert({
          ...payload,
          monthly_change: 0,
          original_balance: account.originalBalance ?? account.balance,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      accountIdMap.set(account.externalAccountId, created.id);
      insertedExternalIds.push(account.externalAccountId);
      inserted += 1;
    }

    console.info("[plaid/sync] upsertLinkedAccounts", {
      connectionId: input.connectionId,
      userId: input.userId,
      total: input.accounts.length,
      inserted,
      updated,
      insertedExternalIds,
    });

    return { accountIdMap, insertedExternalIds, updatedExternalIds };
  }

  async persistSyncedTransactions(input: {
    userId: string;
    householdId: string | null;
    accountIdMap: Map<string, string>;
    transactions: PlaidMappedTransaction[];
    removedExternalIds: string[];
  }): Promise<{
    added: number;
    modified: number;
    removed: number;
    skipped: Array<{ reason: PlaidTransactionSkipReason; count: number }>;
  }> {
    let added = 0;
    let modified = 0;
    let removed = 0;
    let skippedMissingAccount = 0;
    let skippedPending = 0;
    const timestamp = new Date().toISOString();

    for (const transaction of input.transactions) {
      if (transaction.isPending) {
        skippedPending += 1;
        continue;
      }

      const accountId = input.accountIdMap.get(transaction.externalAccountId);

      if (!accountId) {
        skippedMissingAccount += 1;
        continue;
      }

      const { data: existing, error: existingError } = await this.supabase
        .from("transactions")
        .select("id")
        .eq("user_id", input.userId)
        .eq("external_transaction_id", transaction.externalTransactionId)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      const payload = {
        user_id: input.userId,
        household_id: input.householdId,
        transaction_type: transaction.type,
        name: transaction.name,
        amount: transaction.amount,
        category: transaction.category,
        account_id: accountId,
        transfer_to_account_id: null,
        notes: transaction.notes,
        transaction_date: `${transaction.date}T12:00:00.000Z`,
        external_transaction_id: transaction.externalTransactionId,
        updated_at: timestamp,
      };

      if (existing?.id) {
        const { error } = await this.supabase
          .from("transactions")
          .update(payload)
          .eq("id", existing.id)
          .eq("user_id", input.userId);

        if (error) {
          throw error;
        }

        modified += 1;
        continue;
      }

      const { error } = await this.supabase.from("transactions").insert(payload);

      if (error) {
        throw error;
      }

      added += 1;
    }

    if (input.removedExternalIds.length > 0) {
      const { data, error } = await this.supabase
        .from("transactions")
        .delete()
        .eq("user_id", input.userId)
        .in("external_transaction_id", input.removedExternalIds)
        .select("id");

      if (error) {
        throw error;
      }

      removed = data?.length ?? 0;
    }

    if (skippedMissingAccount > 0) {
      console.warn("[plaid/sync] transactions skipped (missing account map)", {
        userId: input.userId,
        skippedMissingAccount,
      });
    }

    const skipped: Array<{ reason: PlaidTransactionSkipReason; count: number }> =
      [];

    if (skippedMissingAccount > 0) {
      skipped.push({
        reason: "missing_account_map",
        count: skippedMissingAccount,
      });
    }

    if (skippedPending > 0) {
      skipped.push({
        reason: "pending_transaction",
        count: skippedPending,
      });
    }

    return { added, modified, removed, skipped };
  }

  async upsertInvestmentHoldings(input: {
    userId: string;
    householdId: string | null;
    connectionId: string;
    itemId: string;
    institutionName: string;
    institutionLogoUrl: string | null;
    accounts: InvestmentAccount[];
    holdings: Holding[];
    securities: Security[];
  }): Promise<void> {
    const timestamp = new Date().toISOString();
    const securityMap = new Map(input.securities.map((item) => [item.security_id, item]));

    for (const account of input.accounts) {
      const mapped = mapPlaidAccount({
        account,
        itemId: input.itemId,
        institutionName: input.institutionName,
        institutionLogoUrl: input.institutionLogoUrl,
      });

      const accountHoldings = input.holdings.filter(
        (holding) => holding.account_id === account.account_id,
      );
      const totalValue = accountHoldings.reduce((sum, holding) => {
        const security = securityMap.get(holding.security_id);
        const price = toNumber(security?.close_price ?? holding.institution_price);
        return sum + toNumber(holding.quantity) * price;
      }, 0);

      const { data: existing, error: existingError } = await this.supabase
        .from("investments")
        .select("id")
        .eq("user_id", input.userId)
        .eq("external_account_id", account.account_id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      const payload = {
        user_id: input.userId,
        household_id: input.householdId,
        name: mapped.name,
        value: totalValue || mapped.balance,
        monthly_change: 0,
        monthly_contribution: 0,
        type: "brokerage",
        bank_connection_id: input.connectionId,
        external_account_id: account.account_id,
        external_item_id: input.itemId,
        institution_logo_url: input.institutionLogoUrl,
        available_balance: mapped.availableBalance,
        last_four: mapped.lastFour,
        last_synced_at: timestamp,
        updated_at: timestamp,
      };

      if (existing?.id) {
        const { error } = await this.supabase
          .from("investments")
          .update(payload)
          .eq("id", existing.id)
          .eq("user_id", input.userId);

        if (error) {
          throw error;
        }
        continue;
      }

      const { error } = await this.supabase.from("investments").insert(payload);

      if (error) {
        throw error;
      }
    }

    const externalAccountIds = input.accounts.map((account) => account.account_id);

    if (externalAccountIds.length > 0) {
      const { error: pruneError } = await this.supabase
        .from("accounts")
        .delete()
        .eq("user_id", input.userId)
        .eq("record_kind", "investment")
        .in("external_account_id", externalAccountIds);

      if (pruneError) {
        throw pruneError;
      }
    }
  }

  async upsertLiabilities(input: {
    userId: string;
    householdId: string | null;
    connectionId: string;
    itemId: string;
    institutionName: string;
    institutionLogoUrl: string | null;
    liabilities: LiabilitiesObject;
    accounts: AccountBase[];
  }): Promise<void> {
    const timestamp = new Date().toISOString();

    for (const account of input.accounts) {
      const mapped = mapPlaidAccount({
        account,
        itemId: input.itemId,
        institutionName: input.institutionName,
        institutionLogoUrl: input.institutionLogoUrl,
      });

      if (mapped.recordKind !== "debt") {
        continue;
      }

      const credit = input.liabilities.credit?.find(
        (item) => item.account_id === account.account_id,
      );
      const mortgage = input.liabilities.mortgage?.find(
        (item) => item.account_id === account.account_id,
      );
      const student = input.liabilities.student?.find(
        (item) => item.account_id === account.account_id,
      );

      const { data: existing, error: existingError } = await this.supabase
        .from("accounts")
        .select("id, original_balance, monthly_change, interest_rate, minimum_payment, due_day")
        .eq("user_id", input.userId)
        .eq("external_account_id", account.account_id)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      const dueDay =
        dueDayFromIsoDate(credit?.next_payment_due_date) ??
        dueDayFromIsoDate(credit?.last_payment_date) ??
        dueDayFromIsoDate(mortgage?.next_payment_due_date) ??
        dueDayFromIsoDate(student?.last_payment_date) ??
        mapped.dueDay ??
        1;

      const payload = {
        user_id: input.userId,
        household_id: input.householdId,
        record_kind: "debt" as const,
        name: mapped.name,
        institution: mapped.institution,
        type: mapped.type,
        balance: mapped.balance,
        bank_connection_id: input.connectionId,
        external_account_id: account.account_id,
        external_item_id: input.itemId,
        institution_logo_url: input.institutionLogoUrl,
        available_balance: null,
        last_four: mapped.lastFour,
        last_synced_at: timestamp,
        interest_rate:
          credit?.aprs?.[0]?.apr_percentage ??
          mortgage?.interest_rate?.percentage ??
          student?.interest_rate_percentage ??
          null,
        minimum_payment:
          credit?.minimum_payment_amount ??
          mortgage?.next_monthly_payment ??
          student?.minimum_payment_amount ??
          null,
        due_day: dueDay,
        updated_at: timestamp,
      };

      if (existing?.id) {
        const { error } = await this.supabase
          .from("accounts")
          .update({
            ...payload,
            monthly_change: existing.monthly_change ?? 0,
            original_balance: existing.original_balance ?? mapped.balance,
            interest_rate: payload.interest_rate ?? existing.interest_rate,
            minimum_payment: payload.minimum_payment ?? existing.minimum_payment,
            due_day: payload.due_day ?? existing.due_day ?? 1,
          })
          .eq("id", existing.id)
          .eq("user_id", input.userId);

        if (error) {
          throw error;
        }
        continue;
      }

      const { error } = await this.supabase.from("accounts").insert({
        ...payload,
        monthly_change: 0,
        original_balance: mapped.balance,
      });

      if (error) {
        throw error;
      }
    }
  }

  async listRecurringDismissals(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("plaid_recurring_dismissals")
      .select("merchant_key")
      .eq("user_id", userId);

    if (error) {
      if (error.message.includes("plaid_recurring_dismissals")) {
        return [];
      }

      throw error;
    }

    return (data ?? []).map((row) => row.merchant_key);
  }

  async dismissRecurringSuggestion(input: {
    userId: string;
    householdId: string | null;
    merchantKey: string;
  }): Promise<void> {
    const { error } = await this.supabase.from("plaid_recurring_dismissals").upsert(
      {
        user_id: input.userId,
        household_id: input.householdId,
        merchant_key: input.merchantKey.toLowerCase().trim(),
      },
      { onConflict: "user_id,merchant_key" },
    );

    if (error) {
      throw error;
    }
  }

  async listLinkedAccounts(userId: string) {
    const { data, error } = await this.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .not("bank_connection_id", "is", null);

    if (error) {
      throw error;
    }

    return data ?? [];
  }
}

export type { Database };
