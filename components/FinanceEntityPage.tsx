"use client";

import { PagePlaceholder } from "@/components/PagePlaceholder";
import { Card, LoadingSkeleton } from "@/components/ui";
import { useFinance, type FinanceContextValue } from "@/context/FinanceContext";
import type { FinanceData } from "@/lib/finance/types";
import { getRequiredNavRoute, type NavRoute } from "@/lib/navigation";

type FinanceEntityPageProps = {
  href: NavRoute["href"];
};

function getFinanceEntity(
  finance: FinanceData,
  href: NavRoute["href"],
): FinanceData[keyof FinanceData] | null {
  switch (href) {
    case "/accounts":
      return finance.accounts;
    case "/income":
      return finance.income;
    case "/bills":
      return finance.bills;
    case "/savings":
      return finance.savingsGoals;
    case "/debt":
      return finance.debts;
    default:
      return null;
  }
}

function getFinancePageAttributes(
  finance: FinanceContextValue,
  href: NavRoute["href"],
) {
  const entityData = getFinanceEntity(finance, href);

  if (entityData) {
    return {
      "data-finance-entity": href,
      "data-finance-count": entityData.length,
    };
  }

  if (href === "/reports") {
    return {
      "data-finance-kpis": finance.dashboard.kpiMetrics.length,
    };
  }

  if (href === "/settings") {
    return {
      "data-finance-loading": finance.isLoading,
    };
  }

  return {};
}

export function FinanceEntityPage({ href }: FinanceEntityPageProps) {
  const finance = useFinance();
  const route = getRequiredNavRoute(href);
  const pageAttributes = getFinancePageAttributes(finance, href);

  if (finance.isLoading) {
    return (
      <Card padding="lg">
        <LoadingSkeleton lines={4} />
      </Card>
    );
  }

  return (
    <div className="contents" {...pageAttributes}>
      <PagePlaceholder title={route.label} subtitle={route.subtitle} />
    </div>
  );
}
