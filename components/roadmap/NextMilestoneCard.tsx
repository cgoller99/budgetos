"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, ProgressRing } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

type NextMilestoneCardProps = {
  embedded?: boolean;
};

export function NextMilestoneCard({ embedded = false }: NextMilestoneCardProps) {
  const { dashboard } = useFinance();
  const nextMilestone = dashboard.nextMilestone;

  const content = !nextMilestone ? (
    <p className="text-base text-white/38">
      No upcoming milestones yet.{" "}
      <Link href="/roadmap" className="text-white/60 hover:text-white">
        View roadmap
      </Link>
    </p>
  ) : (
    <div className="flex items-center gap-6">
      <ProgressRing value={nextMilestone.percentComplete} size={80}>
        <div className="text-center">
          <span className="text-lg">{nextMilestone.icon}</span>
          <p className="mt-0.5 text-xs font-semibold tabular-nums">
            {nextMilestone.percentComplete}%
          </p>
        </div>
      </ProgressRing>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-base font-medium text-white">
          {nextMilestone.name}
        </p>
        <p className="mt-2 text-sm text-white/40">
          {formatCurrency(nextMilestone.remaining)} remaining ·{" "}
          {nextMilestone.estimatedCompletionDate}
        </p>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  if (!nextMilestone) {
    return (
      <Card>
        <CardHeader title="Next milestone" />
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return (
    <Card hover>
      <CardHeader
        title="Next milestone"
        action={
          <Link
            href="/roadmap"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            Roadmap
          </Link>
        }
      />
      <CardContent>{content}</CardContent>
    </Card>
  );
}
