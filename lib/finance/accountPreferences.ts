import { isCashAccountType } from "@/lib/finance/accountTypes";
import type { Account, Debt, FinanceData } from "@/lib/finance/types";

export const ACCOUNT_ICON_OPTIONS = [
  "🏦",
  "💳",
  "💰",
  "📈",
  "🪙",
  "💵",
  "🏠",
  "✈️",
  "🚗",
  "🎯",
] as const;

export const ACCOUNT_COLOR_OPTIONS = [
  { value: "blue", label: "Blue", className: "bg-[var(--accent)]" },
  { value: "emerald", label: "Green", className: "bg-emerald-500" },
  { value: "amber", label: "Amber", className: "bg-amber-500" },
  { value: "rose", label: "Rose", className: "bg-rose-500" },
  { value: "violet", label: "Violet", className: "bg-violet-500" },
  { value: "cyan", label: "Cyan", className: "bg-cyan-500" },
] as const;

export type AccountColor = (typeof ACCOUNT_COLOR_OPTIONS)[number]["value"];

export function getAccountDisplayName(account: Account): string {
  return account.nickname?.trim() || account.name;
}

export function isAccountArchived(account: Account): boolean {
  return Boolean(account.archivedAt);
}

export function isAccountVisible(account: Account): boolean {
  return !account.isHidden && !isAccountArchived(account);
}

export function isAccountIncludedInNetWorth(account: Account): boolean {
  return account.includeInNetWorth !== false && isAccountVisible(account);
}

export function isAccountIncludedInSafeToSpend(account: Account): boolean {
  return (
    account.includeInSafeToSpend !== false &&
    isAccountVisible(account) &&
    isCashAccountType(account.type)
  );
}

export type AccountReferenceCounts = {
  transactions: number;
  bills: number;
  incomeSources: number;
};

export function getAccountReferenceCounts(
  data: FinanceData,
  accountId: string,
): AccountReferenceCounts {
  const transactions = data.transactions.filter(
    (transaction) =>
      transaction.accountId === accountId ||
      transaction.transferAccountId === accountId,
  ).length;

  const bills = data.bills.filter(
    (bill) =>
      bill.paymentAccountId === accountId ||
      (bill.splits ?? []).some((split) => split.paymentAccountId === accountId),
  ).length;

  const incomeSources = data.income.filter(
    (source) => source.depositAccountId === accountId,
  ).length;

  return { transactions, bills, incomeSources };
}

export function getAccountsOnSameConnection(
  accounts: Account[],
  account: Account,
): Account[] {
  if (!account.bankConnectionId) {
    return [account];
  }

  return accounts.filter(
    (item) => item.bankConnectionId === account.bankConnectionId,
  );
}

export type PlaidConnectionMember = {
  id: string;
  name: string;
  kind: "account" | "debt";
};

export function listPlaidConnectionMembers(input: {
  accounts: Account[];
  debts: Debt[];
  account: Pick<Account, "id" | "name" | "nickname" | "bankConnectionId">;
}): PlaidConnectionMember[] {
  const connectionId = input.account.bankConnectionId;

  if (!connectionId) {
    return [
      {
        id: input.account.id,
        name: input.account.nickname?.trim() || input.account.name,
        kind: "account",
      },
    ];
  }

  const accounts = input.accounts
    .filter((item) => item.bankConnectionId === connectionId)
    .map((item) => ({
      id: item.id,
      name: getAccountDisplayName(item),
      kind: "account" as const,
    }));
  const debts = input.debts
    .filter((item) => item.bankConnectionId === connectionId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      kind: "debt" as const,
    }));

  const members = [...accounts, ...debts];

  if (members.some((item) => item.id === input.account.id)) {
    return members;
  }

  return [
    {
      id: input.account.id,
      name: input.account.nickname?.trim() || input.account.name,
      kind: "account",
    },
    ...members,
  ];
}
