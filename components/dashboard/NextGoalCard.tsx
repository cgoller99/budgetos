"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, ProgressRing } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

export function NextGoalCard() {
  const { dashboard } = useFinance();
  const nextGoal = dashboard.nextGoal;

  if (!nextGoal) {
    return (
      <Card>
        <CardHeader
          title="Next Goal"
          description="Your closest milestone"
        />
        <CardContent>
          <p className="text-sm text-white/45">
            All goals complete.{" "}
            <Link href="/savings" className="text-[#0077ed] hover:underline">
              Create a new goal
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card hover>
      <CardHeader title="Next Goal" description="Your closest milestone" />

      <CardContent>
        <div className="flex items-center gap-5">
          <ProgressRing value={nextGoal.percentComplete} size={88}>
            <div className="text-center">
              <span className="text-lg">{nextGoal.icon}</span>
              <p className="mt-0.5 text-xs font-semibold tabular-nums">
                {nextGoal.percentComplete}%
              </p>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-white/35">
                Goal
              </p>
              <p className="mt-1 truncate text-base font-semibold text-white">
                {nextGoal.name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-white/40">Complete</p>
                <p className="mt-1 font-medium tabular-nums text-emerald-400">
                  {nextGoal.percentComplete}%
                </p>
              </div>
              <div>
                <p className="text-white/40">Est. Finish</p>
                <p className="mt-1 font-medium text-white/80">
                  {nextGoal.estimatedCompletionDate}
                </p>
              </div>
            </div>

            <p className="text-xs text-white/45">
              {formatCurrency(nextGoal.remaining)} remaining
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
