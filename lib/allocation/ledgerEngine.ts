import type {
  AllocationFrequency,
  AllocationLedgerEntry,
  EnvelopeType,
} from "@/lib/allocation/types";
import type { FinanceData } from "@/lib/finance/types";

export function createLedgerEntry(
  partial: Omit<AllocationLedgerEntry, "id" | "createdAt"> & { id?: string },
): AllocationLedgerEntry {
  return {
    id: partial.id ?? crypto.randomUUID(),
    paycheckEventId: partial.paycheckEventId ?? null,
    allocationId: partial.allocationId ?? null,
    sourceAccountId: partial.sourceAccountId ?? null,
    destinationType: partial.destinationType,
    destinationId: partial.destinationId ?? null,
    destinationName: partial.destinationName,
    amount: partial.amount,
    transferDate: partial.transferDate,
    frequency: partial.frequency ?? null,
    transactionId: partial.transactionId ?? null,
    entryType: partial.entryType,
    createdAt: new Date().toISOString(),
  };
}

export function appendLedgerEntries(
  data: FinanceData,
  entries: AllocationLedgerEntry[],
): FinanceData {
  if (entries.length === 0) {
    return data;
  }

  return {
    ...data,
    allocationLedger: [...entries, ...(data.allocationLedger ?? [])],
  };
}

export function getLedgerForAllocation(
  data: FinanceData,
  allocationId: string,
): AllocationLedgerEntry[] {
  return (data.allocationLedger ?? []).filter(
    (entry) => entry.allocationId === allocationId,
  );
}

export function getLedgerInRange(
  data: FinanceData,
  startDate: string,
  endDate: string,
): AllocationLedgerEntry[] {
  return (data.allocationLedger ?? []).filter(
    (entry) => entry.transferDate >= startDate && entry.transferDate <= endDate,
  );
}

export function buildPaycheckLedgerEntry(params: {
  paycheckEventId: string;
  allocationId: string;
  sourceAccountId: string;
  destinationType: EnvelopeType | "account";
  destinationId: string | null;
  destinationName: string;
  amount: number;
  transferDate: string;
  frequency: AllocationFrequency | null;
  transactionId: string | null;
}): AllocationLedgerEntry {
  return createLedgerEntry({
    paycheckEventId: params.paycheckEventId,
    allocationId: params.allocationId,
    sourceAccountId: params.sourceAccountId,
    destinationType: params.destinationType,
    destinationId: params.destinationId,
    destinationName: params.destinationName,
    amount: params.amount,
    transferDate: params.transferDate,
    frequency: params.frequency,
    transactionId: params.transactionId,
    entryType: "paycheck_allocation",
  });
}
