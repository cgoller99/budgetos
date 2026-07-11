import { isAccountIncludedInNetWorth } from "@/lib/finance/accountPreferences";
import { isCashAccountType } from "@/lib/finance/accountTypes";
import type { Account, Debt, FinanceData, Investment } from "@/lib/finance/types";
import { isPropertyAsset, isInvestmentAccount } from "@/lib/calculations/netWorthInternals";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function collectUniqueDebtBalances(data: FinanceData): {
  items: Array<{ id: string; name: string; balance: number; source: "debt" | "account" }>;
  total: number;
} {
  const seenExternalIds = new Set<string>();
  const seenIds = new Set<string>();
  const items: Array<{ id: string; name: string; balance: number; source: "debt" | "account" }> =
    [];

  for (const debt of data.debts ?? []) {
    const externalId = debt.externalAccountId ?? null;

    if (externalId) {
      if (seenExternalIds.has(externalId)) {
        continue;
      }
      seenExternalIds.add(externalId);
    }

    if (seenIds.has(debt.id)) {
      continue;
    }

    seenIds.add(debt.id);
    items.push({
      id: debt.id,
      name: debt.name,
      balance: debt.balance,
      source: "debt",
    });
  }

  for (const account of data.accounts ?? []) {
    if (account.type !== "credit_card" || !isAccountIncludedInNetWorth(account)) {
      continue;
    }

    const externalId = account.externalAccountId ?? null;

    if (externalId && seenExternalIds.has(externalId)) {
      continue;
    }

    if (seenIds.has(account.id)) {
      continue;
    }

    if (externalId) {
      seenExternalIds.add(externalId);
    }

    seenIds.add(account.id);
    items.push({
      id: account.id,
      name: account.name,
      balance: account.balance,
      source: "account",
    });
  }

  return {
    items,
    total: sum(items.map((item) => item.balance)),
  };
}

export function collectUniqueInvestmentValues(data: FinanceData): {
  items: Array<{ id: string; name: string; value: number; source: "investment" | "account" }>;
  total: number;
} {
  const seenExternalIds = new Set<string>();
  const seenIds = new Set<string>();
  const items: Array<{
    id: string;
    name: string;
    value: number;
    source: "investment" | "account";
  }> = [];

  for (const investment of data.investments ?? []) {
    const externalId = investment.externalAccountId ?? null;

    if (externalId) {
      if (seenExternalIds.has(externalId)) {
        continue;
      }
      seenExternalIds.add(externalId);
    }

    if (seenIds.has(investment.id)) {
      continue;
    }

    seenIds.add(investment.id);
    items.push({
      id: investment.id,
      name: investment.name,
      value: investment.value,
      source: "investment",
    });
  }

  for (const account of data.accounts ?? []) {
    if (
      !isInvestmentAccount(account) ||
      isPropertyAsset(account) ||
      !isAccountIncludedInNetWorth(account)
    ) {
      continue;
    }

    const externalId = account.externalAccountId ?? null;

    if (externalId && seenExternalIds.has(externalId)) {
      continue;
    }

    if (seenIds.has(account.id)) {
      continue;
    }

    if (externalId) {
      seenExternalIds.add(externalId);
    }

    seenIds.add(account.id);
    items.push({
      id: account.id,
      name: account.name,
      value: account.balance,
      source: "account",
    });
  }

  return {
    items,
    total: sum(items.map((item) => item.value)),
  };
}

export function collectCashAccounts(data: FinanceData): Account[] {
  return (data.accounts ?? []).filter(
    (account) =>
      isCashAccountType(account.type) && isAccountIncludedInNetWorth(account),
  );
}

export function dedupeAccountsByExternalId(accounts: Account[]): Account[] {
  const seen = new Set<string>();
  const result: Account[] = [];

  for (const account of accounts) {
    const externalId = account.externalAccountId;

    if (externalId) {
      if (seen.has(externalId)) {
        continue;
      }
      seen.add(externalId);
    }

    result.push(account);
  }

  return result;
}

export function dedupeInvestmentsByExternalId(investments: Investment[]): Investment[] {
  const seen = new Set<string>();
  const result: Investment[] = [];

  for (const investment of investments) {
    const externalId = investment.externalAccountId;

    if (externalId) {
      if (seen.has(externalId)) {
        continue;
      }
      seen.add(externalId);
    }

    result.push(investment);
  }

  return result;
}

export function dedupeDebtsByExternalId(debts: Debt[]): Debt[] {
  const seen = new Set<string>();
  const result: Debt[] = [];

  for (const debt of debts) {
    const externalId = debt.externalAccountId;

    if (externalId) {
      if (seen.has(externalId)) {
        continue;
      }
      seen.add(externalId);
    }

    result.push(debt);
  }

  return result;
}
