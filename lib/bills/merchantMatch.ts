/**
 * Shared merchant-name normalization and bill ↔ transaction matching.
 */

export function normalizeMerchantKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function transactionLabel(transaction: {
  notes?: string | null;
  category?: string | null;
}): string {
  return (transaction.notes ?? transaction.category ?? "").trim();
}

export type MerchantMatchResult = {
  match: boolean;
  score: number;
  reason: string;
};

export function scoreMerchantMatch(
  billName: string,
  transactionText: string,
): MerchantMatchResult {
  const billKey = normalizeMerchantKey(billName);
  const txnKey = normalizeMerchantKey(transactionText);

  if (!billKey || !txnKey) {
    return { match: false, score: 0, reason: "empty_merchant" };
  }

  if (billKey === txnKey) {
    return { match: true, score: 100, reason: "exact" };
  }

  if (billKey.includes(txnKey) || txnKey.includes(billKey)) {
    return { match: true, score: 85, reason: "substring" };
  }

  const billTokens = billKey.split(" ").filter((token) => token.length >= 3);
  const txnTokens = txnKey.split(" ").filter((token) => token.length >= 3);
  const sharedTokens = billTokens.filter((token) => txnTokens.includes(token));

  if (sharedTokens.length > 0) {
    const score = Math.min(80, 40 + sharedTokens.length * 15);
    return {
      match: true,
      score,
      reason: `shared_tokens:${sharedTokens.join(",")}`,
    };
  }

  const billStem = billTokens[0];
  if (billStem && billStem.length >= 4 && txnKey.includes(billStem)) {
    return { match: true, score: 65, reason: "primary_token" };
  }

  return { match: false, score: 0, reason: "no_merchant_overlap" };
}

export function amountsMatch(
  billAmount: number,
  transactionAmount: number,
  toleranceRatio = 0.05,
): boolean {
  if (billAmount <= 0 || transactionAmount <= 0) {
    return false;
  }

  const tolerance = Math.max(billAmount * toleranceRatio, 1);
  return Math.abs(transactionAmount - billAmount) <= tolerance;
}
