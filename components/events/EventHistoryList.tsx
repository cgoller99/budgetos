"use client";

import { cn } from "@/components/ui/cn";
import type { ActivityItem, FinanceEventTone } from "@/lib/events/types";
import { formatEventTimestamp } from "@/lib/events";

type EventHistoryListProps = {
  items: ActivityItem[];
  emptyMessage?: string;
  className?: string;
};

const toneClasses: Record<FinanceEventTone, string> = {
  positive: "text-emerald-400/90",
  negative: "text-rose-300/90",
  neutral: "text-white/70",
  accent: "text-[#0077ed]",
};

export function EventHistoryList({
  items,
  emptyMessage = "Activity will appear here as you manage your finances.",
  className,
}: EventHistoryListProps) {
  if (items.length === 0) {
    return (
      <p className={cn("text-base text-white/38", className)}>{emptyMessage}</p>
    );
  }

  return (
    <ul className={cn("space-y-4", className)}>
      {items.map((item, index) => (
        <li
          key={item.id}
          className="activity-enter flex items-start gap-4 py-1"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-lg">
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-base font-medium", toneClasses[item.tone])}>
              {item.label}
            </p>
          </div>
          <span className="shrink-0 text-sm text-white/32">
            {formatEventTimestamp(item.timestamp)}
          </span>
        </li>
      ))}
    </ul>
  );
}
