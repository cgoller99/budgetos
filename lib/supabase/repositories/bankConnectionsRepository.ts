import type {
  AccountBase,
  Holding,
  LiabilitiesObject,
  Security,
  InvestmentAccount,
} from "plaid";
import type { BankConnection, BankConnectionStatus } from "@/lib/finance/types";
import type { PlaidMappedAccount, PlaidMappedTransaction } from "@/lib/plaid/types";
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
        external_account_id: null,
        external_item_id: null,
        updated_at: timestamp,
      })
      .eq("bank_connection_id", connectionId)
      .eq("user_id", userId);

    await this.supabase
      .from("investments")
      .update({
        bank_connection_id: null,
        external_account_id: null,
        external_item_id: null,
        updated_at: timestamp,
      })
      .eq("bank_connection_id", connectionId)
      .eq("user_id", userId);
  }

  async upsertLinkedAccounts(input: {
    userId: string;
    householdId: string | null;
    connectionId: string;
    accounts: PlaidMappedAccount[];
  }): Promise<Map<string, string>> {
    const accountIdMap = new Map<string, string>();
    const timestamp = new Date().toISOString();

    for (const account of input.accounts) {
      if (account.recordKind === "investment") {
        continue;
      }

      const { data: existing, error: existingError } = await this.supabase
        .from("accounts")
        .select("id")
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
        monthly_change: 0,
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
        original_balance: account.originalBalance ?? null,
        updated_at: timestamp,
      };

      if (existing?.id) {
        const { error } = await this.supabase
          .from("accounts")
          .update(payload)
          .eq("id", existing.id);

        if (error) {
          throw error;
        }

        accountIdMap.set(account.externalAccountId, existing.id);
        continue;
      }

      const { data: created, error } = await this.supabase
        .from("accounts")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      accountIdMap.set(account.externalAccountId, created.id);
    }

    return accountIdMap;
  }

  async persistSyncedTransactions(input: {
    userId: string;
    householdId: string | null;
    accountIdMap: Map<string, string>;
    transactions: PlaidMappedTransaction[];
    removedExternalIds: string[];
  }): Promise<{ added: number; modified: number; removed: number }> {
    let added = 0;
    let modified = 0;
    let removed = 0;
    const timestamp = new Date().toISOString();

    for (const transaction of input.transactions) {
      const accountId = input.accountIdMap.get(transaction.externalAccountId);

      if (!accountId) {
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
          .eq("id", existing.id);

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

    return { added, modified, removed };
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
          .eq("id", existing.id);

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
        record_kind: "debt" as const,
        name: mapped.name,
        institution: mapped.institution,
        type: mapped.type,
        balance: mapped.balance,
        monthly_change: 0,
        bank_connection_id: input.connectionId,
        external_account_id: account.account_id,
        external_item_id: input.itemId,
        institution_logo_url: input.institutionLogoUrl,
        available_balance: mapped.availableBalance,
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
        due_day: 1,
        original_balance: mapped.balance,
        updated_at: timestamp,
      };

      if (existing?.id) {
        const { error } = await this.supabase
          .from("accounts")
          .update(payload)
          .eq("id", existing.id);

        if (error) {
          throw error;
        }
        continue;
      }

      const { error } = await this.supabase.from("accounts").insert(payload);

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
