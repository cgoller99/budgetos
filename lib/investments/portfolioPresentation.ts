import { collectUniqueInvestmentValues } from "@/lib/calculations/balanceAggregation";
import { calculateInvestments } from "@/lib/calculations/netWorth";
import { formatCurrency } from "@/lib/finance/format";
import type { FinanceData } from "@/lib/finance/types";

export type PortfolioHolding = {
  id: string;
  name: string;
  value: number;
  subtitle: string;
  source: "investment" | "account";
};

/**
 * Resolve what the Investments screen should show.
 * Portfolio value must not contradict an empty holdings state.
 */
export function getPortfolioPresentation(data: FinanceData): {
  hasHoldings: boolean;
  portfolioValue: number;
  monthlyChange: number;
  holdings: PortfolioHolding[];
} {
  const investments = data.investments ?? [];
  const aggregated = collectUniqueInvestmentValues(data);
  const kpi = calculateInvestments(data);

  const fromInvestments: PortfolioHolding[] = investments.map((investment) => ({
    id: investment.id,
    name: investment.name,
    value: investment.value,
    subtitle: `${investment.type} · ${formatCurrency(investment.monthlyContribution)}/mo`,
    source: "investment" as const,
  }));

  const investmentExternalIds = new Set(
    investments
      .map((investment) => investment.externalAccountId)
      .filter((value): value is string => Boolean(value)),
  );
  const investmentIds = new Set(investments.map((investment) => investment.id));

  const fromAccounts: PortfolioHolding[] = aggregated.items
    .filter((item) => item.source === "account")
    .filter((item) => !investmentIds.has(item.id))
    .filter((item) => {
      const account = (data.accounts ?? []).find((entry) => entry.id === item.id);
      if (!account?.externalAccountId) return true;
      return !investmentExternalIds.has(account.externalAccountId);
    })
    .map((item) => {
      const account = (data.accounts ?? []).find((entry) => entry.id === item.id);
      return {
        id: item.id,
        name: account?.nickname || item.name,
        value: item.value,
        subtitle: account?.institution
          ? `${account.institution} · Linked account`
          : "Linked investment account",
        source: "account" as const,
      };
    });

  const holdings = [...fromInvestments, ...fromAccounts].filter(
    (holding) => Number.isFinite(holding.value),
  );
  const hasHoldings = holdings.length > 0;

  // If nothing to show, never surface a contradictory non-zero portfolio total.
  if (!hasHoldings) {
    return {
      hasHoldings: false,
      portfolioValue: 0,
      monthlyChange: 0,
      holdings: [],
    };
  }

  return {
    hasHoldings: true,
    portfolioValue: kpi.value,
    monthlyChange: kpi.monthlyChange,
    holdings,
  };
}
