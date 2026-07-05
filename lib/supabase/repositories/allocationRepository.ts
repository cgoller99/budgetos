import type { AllocationLedgerEntry } from "@/lib/allocation/types";
import type { StoredEnvelopeBalance } from "@/lib/finance/types";
import type {
  AllocationLedgerRow,
  EnvelopeBalanceRow,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  householdFinanceOrFilter,
  resolveUserHouseholdId,
} from "@/lib/supabase/householdFinance";

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function mapEnvelopeRow(row: EnvelopeBalanceRow): StoredEnvelopeBalance {
  const history = Array.isArray(row.history)
    ? (row.history as StoredEnvelopeBalance["history"])
    : [];

  return {
    id: row.id,
    allocationId: row.allocation_id,
    envelopeType: row.envelope_type,
    entityId: row.entity_id,
    name: row.name,
    icon: row.icon,
    balance: toNumber(row.balance),
    target: row.target === null ? null : toNumber(row.target),
    contributionAmount:
      row.contribution_amount === null
        ? null
        : toNumber(row.contribution_amount),
    contributionFrequency: row.contribution_frequency,
    progress: toNumber(row.progress),
    nextContributionDate: row.next_contribution_date,
    history,
    updatedAt: row.updated_at,
  };
}

function mapLedgerRow(row: AllocationLedgerRow): AllocationLedgerEntry {
  return {
    id: row.id,
    paycheckEventId: row.paycheck_event_id,
    allocationId: row.allocation_id,
    sourceAccountId: row.source_account_id,
    destinationType: row.destination_type as AllocationLedgerEntry["destinationType"],
    destinationId: row.destination_id,
    destinationName: row.destination_name,
    amount: toNumber(row.amount),
    transferDate: row.transfer_date,
    frequency: row.frequency as AllocationLedgerEntry["frequency"],
    transactionId: row.transaction_id,
    entryType: row.entry_type as AllocationLedgerEntry["entryType"],
    createdAt: row.created_at,
  };
}

export class AllocationRepository {
  constructor(private readonly supabase: BuxmeSupabaseClient) {}

  private withHouseholdId<T extends Record<string, unknown>>(
    row: T,
    householdId: string | null,
  ): T {
    if (!householdId) return row;
    return { ...row, household_id: householdId };
  }

  private scopedSelect(table: string, userId: string, householdId: string | null) {
    const scopeFilter = householdFinanceOrFilter(userId, householdId);
    let query = this.supabase.from(table).select("*");

    if (scopeFilter) {
      query = query.or(scopeFilter);
    } else {
      query = query.eq("user_id", userId);
    }

    return query;
  }

  async loadAllocationData(userId: string): Promise<{
    envelopeBalances: StoredEnvelopeBalance[];
    allocationLedger: AllocationLedgerEntry[];
  }> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);

    const [envelopeResult, ledgerResult] = await Promise.all([
      this.scopedSelect("envelope_balances", userId, householdId),
      this.scopedSelect("allocation_ledger", userId, householdId)
        .order("transfer_date", { ascending: false })
        .limit(200),
    ]);

    if (envelopeResult.error) {
      if (envelopeResult.error.message.includes("envelope_balances")) {
        return { envelopeBalances: [], allocationLedger: [] };
      }
      throw envelopeResult.error;
    }

    if (ledgerResult.error) {
      if (ledgerResult.error.message.includes("allocation_ledger")) {
        return {
          envelopeBalances: (envelopeResult.data ?? []).map(mapEnvelopeRow),
          allocationLedger: [],
        };
      }
      throw ledgerResult.error;
    }

    return {
      envelopeBalances: (envelopeResult.data ?? []).map(mapEnvelopeRow),
      allocationLedger: (ledgerResult.data ?? []).map(mapLedgerRow),
    };
  }

  async persistPaycheckAllocationState(
    userId: string,
    data: {
      envelopeBalances: StoredEnvelopeBalance[];
      allocationLedger: AllocationLedgerEntry[];
    },
    newLedgerEntryIds: string[],
  ): Promise<void> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const timestamp = new Date().toISOString();
    const newEntries = data.allocationLedger.filter((entry) =>
      newLedgerEntryIds.includes(entry.id),
    );

    if (newEntries.length > 0) {
      const rows = newEntries.map((entry) =>
        this.withHouseholdId(
          {
            id: entry.id,
            user_id: userId,
            paycheck_event_id: entry.paycheckEventId,
            allocation_id: entry.allocationId,
            source_account_id: entry.sourceAccountId,
            destination_type: entry.destinationType,
            destination_id: entry.destinationId,
            destination_name: entry.destinationName,
            amount: entry.amount,
            transfer_date: entry.transferDate,
            frequency: entry.frequency,
            transaction_id: entry.transactionId,
            entry_type: entry.entryType,
            created_at: entry.createdAt,
          },
          householdId,
        ),
      );

      const { error } = await this.supabase.from("allocation_ledger").insert(rows);
      if (error && !error.message.includes("allocation_ledger")) {
        throw error;
      }
    }

    for (const envelope of data.envelopeBalances) {
      const row = this.withHouseholdId(
        {
          id: envelope.id,
          user_id: userId,
          allocation_id: envelope.allocationId,
          envelope_type: envelope.envelopeType,
          entity_id: envelope.entityId,
          name: envelope.name,
          icon: envelope.icon,
          balance: envelope.balance,
          target: envelope.target,
          contribution_amount: envelope.contributionAmount,
          contribution_frequency: envelope.contributionFrequency,
          progress: envelope.progress,
          next_contribution_date: envelope.nextContributionDate,
          history: envelope.history,
          updated_at: timestamp,
        },
        householdId,
      );

      const { error } = await this.supabase
        .from("envelope_balances")
        .upsert(row, { onConflict: "id" });

      if (error && !error.message.includes("envelope_balances")) {
        throw error;
      }
    }
  }
}
