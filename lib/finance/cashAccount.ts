import { isCashAccountType } from "@/lib/finance/accountTypes";
import type { FinanceData } from "@/lib/finance/types";

export function getPrimaryCashAccount(data: FinanceData) {
  return (
    data.accounts.find((account) => account.type === "checking") ??
    data.accounts.find((account) => isCashAccountType(account.type)) ??
    data.accounts[0]
  );
}

export function adjustPrimaryCashBalance(
  data: FinanceData,
  delta: number,
): FinanceData["accounts"] {
  const account = getPrimaryCashAccount(data);

  if (!account) {
    return data.accounts;
  }

  return data.accounts.map((item) =>
    item.id === account.id
      ? { ...item, balance: item.balance + delta }
      : item,
  );
}
