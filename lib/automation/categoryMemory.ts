import { merchantGroupKey } from "@/lib/bills/merchantMatch";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

export type RememberedCategory = {
  notes?: string | null;
  name?: string | null;
  category?: string | null;
  date: string;
};

export function buildMerchantCategoryMemory(
  transactions: RememberedCategory[],
): Map<string, string> {
  const memory = new Map<string, string>();
  const ordered = [...transactions].sort((left, right) =>
    right.date.localeCompare(left.date),
  );

  for (const transaction of ordered) {
    const key = merchantGroupKey(transaction.notes || transaction.name || "");
    const category = transaction.category?.trim();
    if (key.length < 3 || !category || memory.has(key)) {
      continue;
    }
    memory.set(key, category);
  }

  return memory;
}

/**
 * Existing rows keep the stored category so a later sync cannot undo an edit.
 * New rows reuse a real correction. A remembered label in the same display
 * bucket is upgraded to the canonical category instead of freezing the raw
 * Plaid string.
 */
export function categoryForSyncedTransaction(input: {
  isNew: boolean;
  existingCategory?: string | null;
  incomingCategory: string;
  merchantKey: string;
  memory: Map<string, string>;
}): string {
  const canonicalIncoming = getDisplayCategory(input.incomingCategory);

  if (!input.isNew) {
    const existing = input.existingCategory?.trim();
    if (existing) {
      return existing;
    }
  }

  const remembered = input.memory.get(input.merchantKey)?.trim();
  if (!remembered) {
    return canonicalIncoming;
  }

  if (getDisplayCategory(remembered) === canonicalIncoming) {
    return canonicalIncoming;
  }

  return remembered;
}
