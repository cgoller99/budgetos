"use client";

import Link from "next/link";
import { IosCard, IosSection } from "@/components/native/ios/IosPrimitives";
import { type FinancialInsight } from "@/lib/automation/financialInsights";
import { cn } from "@/components/ui/cn";

type IosInsightsSectionProps = {
  insights: FinancialInsight[];
};

export function IosInsightsSection({ insights }: IosInsightsSectionProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <IosSection title="Insights">
      {insights.length > 0 ? (
        <div className="flex flex-col gap-2">
          {insights.map((insight) => (
            <Link key={insight.id} href={insight.href} className="block active:opacity-90">
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
                <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
                  {insight.detail}
                </p>
              </IosCard>
            </Link>
          ))}
        </div>
      ) : null}
    </IosSection>
  );
}
