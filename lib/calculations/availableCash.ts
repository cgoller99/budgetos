import { isAccountIncludedInSafeToSpend } from "@/lib/finance/accountPreferences";
import { isCashAccountType } from "@/lib/finance/accountTypes";
import type { FinanceData } from "@/lib/finance/types";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Spendable cash from linked/manual accounts included in Safe To Spend.
 * Prefers Plaid available balance when present; falls back to current balance.
 */
export function calculateAvailableCash(data: FinanceData): number {
  const accounts = (data.accounts ?? []).filter(
    (account) =>
      isCashAccountType(account.type) && isAccountIncludedInSafeToSpend(account),
  );

  return sum(
    accounts.map((account) => {
      if (
        account.availableBalance !== null &&
        account.availableBalance !== undefined &&
        Number.isFinite(account.availableBalance)
      ) {
        return Math.max(account.availableBalance, 0);
      }

      return Math.max(account.balance, 0);
    }),
  );
}

export function hasPlaidLinkedCashAccounts(data: FinanceData): boolean {
  return (data.accounts ?? []).some(
    (account) =>
      Boolean(account.externalAccountId) &&
      isCashAccountType(account.type) &&
      isAccountIncludedInSafeToSpend(account),
  );
}
