import type { AllocationLedgerEntry, LedgerReport } from "@/lib/allocation/types";
import type { FinanceData } from "@/lib/finance/types";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function summarizeLedger(
  data: FinanceData,
  limit = 20,
): LedgerReport {
  const entries = data.allocationLedger ?? [];

  const paycheckAllocations = entries
    .filter((entry) => entry.entryType === "paycheck_allocation")
    .reduce((total, entry) => total + entry.amount, 0);

  const recurringContributions = entries
    .filter((entry) => entry.entryType === "recurring_contribution")
    .reduce((total, entry) => total + entry.amount, 0);

  const destinationMap = new Map<
    string,
    { destinationName: string; destinationType: string; total: number; count: number }
  >();

  for (const entry of entries) {
    const key = `${entry.destinationType}:${entry.destinationName}`;
    const existing = destinationMap.get(key) ?? {
      destinationName: entry.destinationName,
      destinationType: entry.destinationType,
      total: 0,
      count: 0,
    };

    existing.total += entry.amount;
    existing.count += 1;
    destinationMap.set(key, existing);
  }

  return {
    totalTransferred: roundCurrency(
      entries.reduce((total, entry) => total + entry.amount, 0),
    ),
    paycheckAllocations: roundCurrency(paycheckAllocations),
    recurringContributions: roundCurrency(recurringContributions),
    byDestination: [...destinationMap.values()]
      .map((item) => ({
        ...item,
        total: roundCurrency(item.total),
      }))
      .sort((left, right) => right.total - left.total),
    recentEntries: entries.slice(0, limit),
  };
}

export function formatLedgerEntry(entry: AllocationLedgerEntry): string {
  const date = entry.transferDate;
  const amount = entry.amount.toFixed(2);
  return `${date}: $${amount} → ${entry.destinationName} (${entry.entryType})`;
}

export function getLedgerAuditTrail(
  data: FinanceData,
  allocationId?: string,
): AllocationLedgerEntry[] {
  const entries = data.allocationLedger ?? [];

  if (!allocationId) {
    return entries;
  }

  return entries.filter((entry) => entry.allocationId === allocationId);
}
