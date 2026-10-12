import { merchantGroupKey } from "@/lib/bills/merchantMatch";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

export type RememberedCategory = {
  notes?: string | null;
  name?: string | null;
  category?: string | null;
  date: string;
};

export type MerchantCategoryMemory = {
  /** Newest stored category for each merchant. */
  latest: Map<string, string>;
  /** Distinct display categories seen for each merchant, newest first. */
  buckets: Map<string, string[]>;
};

const MIXED_CATEGORY_TOKENS = new Set([
  "amazon",
  "amzn",
  "walmart",
  "target",
  "paypal",
]);

/**
 * Stores that sell many kinds of goods, and payment apps that carry
 * unrelated charges. A correction on one purchase must not relabel the next
 * one when that transaction already has its own category.
 */
export function isMixedCategoryMerchant(merchantKey: string): boolean {
  const tokens = merchantKey.toLowerCase().split(" ").filter(Boolean);
  if (tokens.some((token) => MIXED_CATEGORY_TOKENS.has(token))) {
    return true;
  }

  const compact = tokens.join("");
  return (
    compact.includes("amazon") ||
    compact.includes("walmart") ||
    compact.includes("paypal") ||
    tokens.some(
      (token) =>
        token.startsWith("amazon") ||
        token.startsWith("amzn") ||
        token.startsWith("walmart"),
    )
  );
}

export function emptyMerchantCategoryMemory(): MerchantCategoryMemory {
  return { latest: new Map(), buckets: new Map() };
}

export function buildMerchantCategoryMemory(
  transactions: RememberedCategory[],
): MerchantCategoryMemory {
  const memory = emptyMerchantCategoryMemory();
  const ordered = [...transactions].sort((left, right) =>
    right.date.localeCompare(left.date),
  );

  for (const transaction of ordered) {
    const key = merchantGroupKey(transaction.notes || transaction.name || "");
    const category = transaction.category?.trim();
    if (key.length < 3 || !category) {
      continue;
    }

    if (!memory.latest.has(key)) {
      memory.latest.set(key, category);
    }

    const display = getDisplayCategory(category);
    const seen = memory.buckets.get(key) ?? [];
    if (!seen.includes(display)) {
      seen.push(display);
      memory.buckets.set(key, seen);
    }
  }

  return memory;
}

export function rememberMerchantCategory(
  memory: MerchantCategoryMemory,
  merchantKey: string,
  category: string,
): void {
  const trimmed = category.trim();
  if (merchantKey.length < 3 || !trimmed) {
    return;
  }

  if (!memory.latest.has(merchantKey)) {
    memory.latest.set(merchantKey, trimmed);
  }

  const display = getDisplayCategory(trimmed);
  const seen = memory.buckets.get(merchantKey) ?? [];
  if (!seen.includes(display)) {
    seen.push(display);
    memory.buckets.set(merchantKey, seen);
  }
}

const VAGUE_CATEGORIES = new Set(["Other", "Uncategorized"]);

/**
 * Existing rows keep the stored category so a later sync cannot undo an edit.
 * Single-purpose merchants reuse a real correction. Mixed merchants such as
 * Amazon keep the incoming transaction category when it is specific.
 */
export function categoryForSyncedTransaction(input: {
  isNew: boolean;
  existingCategory?: string | null;
  incomingCategory: string;
  merchantKey: string;
  memory: MerchantCategoryMemory;
}): string {
  const canonicalIncoming = getDisplayCategory(input.incomingCategory);

  if (!input.isNew) {
    const existing = input.existingCategory?.trim();
    if (existing) {
      return existing;
    }
  }

  const remembered = input.memory.latest.get(input.merchantKey)?.trim();
  if (!remembered) {
    return canonicalIncoming;
  }

  const rememberedDisplay = getDisplayCategory(remembered);
  if (rememberedDisplay === canonicalIncoming) {
    return canonicalIncoming;
  }

  if (isMixedCategoryMerchant(input.merchantKey)) {
    const buckets = input.memory.buckets.get(input.merchantKey) ?? [rememberedDisplay];
    if (VAGUE_CATEGORIES.has(canonicalIncoming) && buckets.length === 1) {
      return rememberedDisplay;
    }

    return canonicalIncoming;
  }

  return remembered;
}
