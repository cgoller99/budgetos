import type { PlaidMappedTransaction, PlaidRecurringCandidate } from "@/lib/plaid/types";
import { detectPlaidRecurringCandidates } from "@/lib/plaid/mappers";

export function detectRecurringBillCandidates(
  transactions: PlaidMappedTransaction[],
  dismissedMerchantKeys: string[] = [],
): PlaidRecurringCandidate[] {
  const dismissed = new Set(dismissedMerchantKeys.map((key) => key.toLowerCase()));

  return detectPlaidRecurringCandidates(transactions).filter(
    (candidate) => !dismissed.has(candidate.merchantKey.toLowerCase()),
  );
}
