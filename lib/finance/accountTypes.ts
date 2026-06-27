import type { AccountType } from "./types";

export const ACCOUNT_TYPE_OPTIONS: {
  value: AccountType;
  label: string;
}[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit Card" },
  { value: "investment", label: "Investment" },
  { value: "crypto", label: "Crypto" },
  { value: "cash", label: "Cash" },
];

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  investment: "Investment",
  crypto: "Crypto",
  cash: "Cash",
};

export function formatAccountType(type: AccountType): string {
  return ACCOUNT_TYPE_LABELS[type];
}

export function isCashAccountType(type: AccountType): boolean {
  return type === "checking" || type === "savings" || type === "cash";
}

export function isLiabilityAccountType(type: AccountType): boolean {
  return type === "credit_card";
}

export function getAccountNetWorthContribution(
  type: AccountType,
  balance: number,
): number {
  return isLiabilityAccountType(type) ? -balance : balance;
}
