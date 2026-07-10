import type { FinanceData } from "@/lib/finance/types";

export function getLinkedAccountName(
  data: FinanceData,
  accountId: string,
): string {
  const cashAccount = data.accounts.find((account) => account.id === accountId);
  if (cashAccount) {
    return cashAccount.name;
  }

  const debtAccount = data.debts.find((debt) => debt.id === accountId);
  if (debtAccount) {
    return debtAccount.name;
  }

  const investment = data.investments.find((item) => item.id === accountId);
  if (investment) {
    return investment.name;
  }

  return "Account";
}

export function hasLinkedFinancialAccounts(data: FinanceData): boolean {
  if ((data.bankConnections?.length ?? 0) > 0) {
    return true;
  }

  return (
    data.accounts.some((account) => account.isPlaidLinked) ||
    data.debts.some((debt) => debt.isPlaidLinked)
  );
}

export function hasAnyCashOrDebtAccounts(data: FinanceData): boolean {
  return data.accounts.length > 0 || data.debts.length > 0;
}
