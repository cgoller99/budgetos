"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IosCard, IosScreen, IosSection } from "@/components/native/ios/IosPrimitives";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import {
  buildFinancialInsights,
  type FinancialInsight,
} from "@/lib/automation/financialInsights";
import { readSavedCategoryBudgets } from "@/lib/automation/savedBudgets";
import { useNativeIos } from "@/lib/native/useNativeIos";

function InsightList({ insights }: { insights: FinancialInsight[] }) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No insights yet. Insights appear when spending, bills, paychecks, budgets, or goals change in a way that is worth a look.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {insights.map((insight) => (
        <Link key={insight.id} href={insight.href} className="block">
          <div className="rounded-[16px] border border-[var(--surface-border)] bg-[var(--surface)] p-4">
            <p
              className={cn(
                "text-[15px] font-semibold",
                insight.tone === "negative"
                  ? "text-[var(--danger)]"
                  : insight.tone === "positive"
                    ? "text-[var(--success)]"
                    : "text-[var(--foreground)]",
              )}
            >
              {insight.title}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">{insight.detail}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function InsightsContent() {
  const finance = useFinance();
  const { user } = useAuth();
  const nativeIos = useNativeIos();
  const [budgets, setBudgets] = useState<Array<{ category: string; amount: number }>>([]);

  useEffect(() => {
    setBudgets(readSavedCategoryBudgets(user?.id));
  }, [user?.id]);

  const insights = useMemo(
    () => buildFinancialInsights(finance, new Date(), budgets),
    [budgets, finance],
  );

  if (nativeIos) {
    return (
      <IosScreen>
        <IosSection title="Insights">
          {insights.length === 0 ? (
            <IosCard padding="md">
              <p className="text-[15px] font-semibold text-[var(--foreground)]">Nothing to flag</p>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                Insights show up when confirmed spending, bills, paychecks, budgets, or goals move in a meaningful way.
              </p>
            </IosCard>
          ) : (
            insights.map((insight) => (
              <Link key={insight.id} href={insight.href} className="block">
                <IosCard padding="md">
                  <p
                    className={cn(
                      "text-[15px] font-semibold",
                      insight.tone === "negative"
                        ? "text-[var(--danger)]"
                        : insight.tone === "positive"
                          ? "text-[var(--success)]"
                          : "text-[var(--foreground)]",
                    )}
                  >
                    {insight.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">{insight.detail}</p>
                </IosCard>
              </Link>
            ))
          )}
        </IosSection>
      </IosScreen>
    );
  }

  return (
    <div className={pageContainerWideClassName}>
      <Card>
        <CardHeader
          title="Insights"
          description="Each note names the confirmed change that triggered it."
        />
        <CardContent>
          <InsightList insights={insights} />
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardInsightsCard() {
  const finance = useFinance();
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Array<{ category: string; amount: number }>>([]);

  useEffect(() => {
    setBudgets(readSavedCategoryBudgets(user?.id));
  }, [user?.id]);

  const insights = useMemo(
    () => buildFinancialInsights(finance, new Date(), budgets).slice(0, 3),
    [budgets, finance],
  );

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        title="Insights"
        action={
          <Link href="/insights" className="text-sm font-semibold text-[var(--accent-light)]">
            See all
          </Link>
        }
      />
      <CardContent>
        <InsightList insights={insights} />
      </CardContent>
    </Card>
  );
}
