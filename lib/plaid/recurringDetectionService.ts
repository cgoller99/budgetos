import type { PlaidMappedTransaction, RecurringBillCandidate } from "@/lib/plaid/types";
import { detectRecurringBillCandidatesFromPlaidTransactions } from "@/lib/plaid/recurringBillDetection";
import type { FinanceData } from "@/lib/finance/types";

export function detectRecurringBillCandidates(
  transactions: PlaidMappedTransaction[],
  dismissedMerchantKeys: string[] = [],
  financeData?: FinanceData,
): RecurringBillCandidate[] {
  return detectRecurringBillCandidatesFromPlaidTransactions(transactions, {
    bills: financeData?.bills ?? [],
    dismissedMerchantKeys,
    financeData,
  });
}

export { detectRecurringBillCandidatesFromFinanceData } from "@/lib/plaid/recurringBillDetection";
