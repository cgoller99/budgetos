"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { insightToneClasses } from "@/lib/finance/format";

export function SmartInsights() {
  const { dashboard } = useFinance();
  const { smartInsights } = dashboard;

  return (
    <Card padding="lg" hover>
      <CardHeader title="Smart insights" />

      <CardContent>
        <ul className="space-y-5">
          {smartInsights.map((insight) => {
            const content = (
              <>
                <span
                  className={`mt-2.5 h-2 w-2 shrink-0 rounded-full ${insightToneClasses[insight.tone]}`}
                />
                <p className="text-base leading-relaxed text-white/58">
                  {insight.before}
                  {insight.highlight && (
                    <span className="font-medium text-[var(--accent-light)]">
                      {insight.highlight}
                    </span>
                  )}
                  {insight.after}
                </p>
              </>
            );

            if (insight.transactionHref) {
              return (
                <li key={`${insight.tone}-${insight.after}`}>
                  <Link
                    href={insight.transactionHref}
                    className="focus-ring flex gap-4 rounded-2xl p-2 transition-colors hover:bg-white/[0.03]"
                  >
                    {content}
                  </Link>
                </li>
              );
            }

            return (
              <li key={`${insight.tone}-${insight.after}`} className="flex gap-4">
                {content}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
