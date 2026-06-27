import { isCashAccountType } from "@/lib/finance/accountTypes";
import type { Account, FinanceData, Investment } from "@/lib/finance/types";
import type { CalculationResult, NetWorthBreakdown } from "./types";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isPropertyAsset(account: Account): boolean {
  const label = `${account.name} ${account.institution}`.toLowerCase();

  return (
    account.type === "investment" &&
    (label.includes("equity") ||
      label.includes("property") ||
      label.includes("residence") ||
      label.includes("home"))
  );
}

function isInvestmentAccount(account: Account): boolean {
  return account.type === "crypto" || account.type === "investment";
}

function categorizeInvestment(investment: Investment): "stocks" | "crypto" | "retirement" {
  const type = (investment.type ?? "").toLowerCase();

  if (type.includes("crypto")) {
    return "crypto";
  }

  if (
    type.includes("401") ||
    type.includes("ira") ||
    type.includes("retirement") ||
    type.includes("roth")
  ) {
    return "retirement";
  }

  return "stocks";
}

function categorizeDebtName(name: string): "credit_card" | "loan" | "mortgage" {
  const normalized = name.toLowerCase();

  if (normalized.includes("credit")) {
    return "credit_card";
  }

  if (normalized.includes("mortgage") || normalized.includes("home loan")) {
    return "mortgage";
  }

  return "loan";
}

export function calculateCash(data: FinanceData): CalculationResult {
  const cashAccounts = (data.accounts ?? []).filter((account) =>
    isCashAccountType(account.type),
  );

  return {
    value: sum(cashAccounts.map((account) => account.balance)),
    monthlyChange: sum(cashAccounts.map((account) => account.monthlyChange)),
  };
}

export function calculateInvestments(data: FinanceData): CalculationResult {
  const portfolioAccounts = (data.accounts ?? []).filter(
    (account) => isInvestmentAccount(account) && !isPropertyAsset(account),
  );
  const portfolioHoldings = data.investments ?? [];

  return {
    value:
      sum(portfolioAccounts.map((account) => account.balance)) +
      sum(portfolioHoldings.map((investment) => investment.value)),
    monthlyChange:
      sum(portfolioAccounts.map((account) => account.monthlyChange)) +
      sum(portfolioHoldings.map((investment) => investment.monthlyChange)),
  };
}

export function calculatePropertyAssets(data: FinanceData): CalculationResult {
  const propertyAccounts = (data.accounts ?? []).filter((account) =>
    isPropertyAsset(account),
  );

  return {
    value: sum(propertyAccounts.map((account) => account.balance)),
    monthlyChange: sum(propertyAccounts.map((account) => account.monthlyChange)),
  };
}

export function calculateDebt(data: FinanceData): CalculationResult {
  const creditCardAccounts = (data.accounts ?? []).filter(
    (account) => account.type === "credit_card",
  );
  const structuredDebts = data.debts ?? [];

  return {
    value:
      sum(creditCardAccounts.map((account) => account.balance)) +
      sum(structuredDebts.map((debt) => debt.balance)),
    monthlyChange:
      sum(creditCardAccounts.map((account) => account.monthlyChange)) +
      sum(structuredDebts.map((debt) => debt.monthlyChange)),
  };
}

export function calculateAssets(data: FinanceData): number {
  return (
    calculateCash(data).value +
    calculateInvestments(data).value +
    calculatePropertyAssets(data).value
  );
}

export function calculateLiabilities(data: FinanceData): number {
  return calculateDebt(data).value;
}

export function calculateNetWorth(data: FinanceData): CalculationResult {
  const cash = calculateCash(data);
  const investments = calculateInvestments(data);
  const propertyAssets = calculatePropertyAssets(data);
  const debt = calculateDebt(data);

  return {
    value: calculateAssets(data) - calculateLiabilities(data),
    monthlyChange:
      cash.monthlyChange +
      investments.monthlyChange +
      propertyAssets.monthlyChange -
      debt.monthlyChange,
  };
}

export function calculateNetWorthBreakdown(data: FinanceData): NetWorthBreakdown {
  return {
    cash: calculateCash(data),
    investments: calculateInvestments(data),
    debt: calculateDebt(data),
    assets: calculateAssets(data),
    liabilities: calculateLiabilities(data),
    netWorth: calculateNetWorth(data),
  };
}

export {
  categorizeDebtName,
  categorizeInvestment,
  isPropertyAsset,
};
