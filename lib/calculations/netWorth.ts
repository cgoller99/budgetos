import {
  collectCashAccounts,
  collectUniqueDebtBalances,
  collectUniqueInvestmentValues,
} from "@/lib/calculations/balanceAggregation";
import { isAccountIncludedInNetWorth } from "@/lib/finance/accountPreferences";
import type { FinanceData, Investment } from "@/lib/finance/types";
import {
  isInvestmentAccount,
  isPropertyAsset,
} from "@/lib/calculations/netWorthInternals";
import type { CalculationResult, NetWorthBreakdown } from "./types";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
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
  const cashAccounts = collectCashAccounts(data);

  return {
    value: sum(cashAccounts.map((account) => account.balance)),
    monthlyChange: sum(cashAccounts.map((account) => account.monthlyChange)),
  };
}

export function calculateInvestments(data: FinanceData): CalculationResult {
  const { items } = collectUniqueInvestmentValues(data);

  return {
    value: sum(items.map((item) => item.value)),
    monthlyChange: sum(
      items.map((item) => {
        if (item.source === "investment") {
          return (
            data.investments?.find((investment) => investment.id === item.id)
              ?.monthlyChange ?? 0
          );
        }

        return (
          data.accounts?.find((account) => account.id === item.id)?.monthlyChange ?? 0
        );
      }),
    ),
  };
}

export function calculatePropertyAssets(data: FinanceData): CalculationResult {
  const propertyAccounts = (data.accounts ?? []).filter(
    (account) => isPropertyAsset(account) && isAccountIncludedInNetWorth(account),
  );

  return {
    value: sum(propertyAccounts.map((account) => account.balance)),
    monthlyChange: sum(propertyAccounts.map((account) => account.monthlyChange)),
  };
}

export function calculateDebt(data: FinanceData): CalculationResult {
  const { items } = collectUniqueDebtBalances(data);

  return {
    value: sum(items.map((item) => item.balance)),
    monthlyChange: sum(
      items.map((item) => {
        if (item.source === "debt") {
          return data.debts?.find((debt) => debt.id === item.id)?.monthlyChange ?? 0;
        }

        return (
          data.accounts?.find((account) => account.id === item.id)?.monthlyChange ?? 0
        );
      }),
    ),
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
  isInvestmentAccount,
  isPropertyAsset,
};
