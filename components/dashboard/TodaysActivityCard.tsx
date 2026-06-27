"use client";

import { useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";

export function TodaysActivityCard() {
  const { dashboard, applyTodayActivity, applyAllTodayActivity } = useFinance();
  const { showToast } = useToast();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  const { activities, pendingCount } = dashboard.todayActivity;

  async function handleApply(activityId: string) {
    setApplyingId(activityId);

    try {
      await applyTodayActivity(activityId);
      showToast({
        title: "✓ Activity Applied",
        subtitle: "✓ Dashboard Updated",
      });
    } finally {
      setApplyingId(null);
    }
  }

  async function handleApplyAll() {
    setIsApplyingAll(true);

    try {
      await applyAllTodayActivity();
      showToast({
        title: "✓ Today's Activity Applied",
        subtitle: "✓ Dashboard Updated",
      });
    } finally {
      setIsApplyingAll(false);
    }
  }

  const actionLabel = useMemo(() => {
    if (pendingCount === 0) {
      return "All caught up";
    }

    return `Apply all (${pendingCount})`;
  }, [pendingCount]);

  if (activities.length === 0) {
    return null;
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Process Today's Activity"
        action={
          <Button
            onClick={() => void handleApplyAll()}
            disabled={pendingCount === 0 || isApplyingAll}
          >
            {isApplyingAll ? "Applying..." : actionLabel}
          </Button>
        }
      />

      <CardContent>
        <ul className="space-y-3">
          {activities.map((activity, index) => (
            <li
              key={activity.id}
              className="activity-enter flex items-center justify-between gap-4 rounded-2xl px-4 py-4 transition-colors duration-200 hover:bg-white/[0.03]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-xl">
                  {activity.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-white">
                    {activity.label}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-white/38">
                    {formatCurrency(activity.amount)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                className={cn(
                  "shrink-0",
                  applyingId === activity.id && "opacity-70",
                )}
                disabled={applyingId !== null || isApplyingAll}
                onClick={() => void handleApply(activity.id)}
              >
                {applyingId === activity.id ? "..." : "Apply"}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
