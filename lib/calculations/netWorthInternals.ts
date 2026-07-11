import type { Account } from "@/lib/finance/types";

export function isPropertyAsset(account: Account): boolean {
  const label = `${account.name} ${account.institution}`.toLowerCase();

  return (
    account.type === "investment" &&
    (label.includes("equity") ||
      label.includes("property") ||
      label.includes("residence") ||
      label.includes("home"))
  );
}

export function isInvestmentAccount(account: Account): boolean {
  return account.type === "crypto" || account.type === "investment";
}
