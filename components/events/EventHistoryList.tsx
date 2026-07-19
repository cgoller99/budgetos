"use client";

import Link from "next/link";
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
  accent: "text-[var(--accent)]",
};

function ActivityListItem({
  item,
  index,
}: {
  item: ActivityItem;
  index: number;
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-lg">
        {item.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-base font-medium", toneClasses[item.tone])}>
          {item.label}
        </p>
        {item.description ? (
          <p className="mt-1 text-sm text-white/40">{item.description}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-sm text-white/32">
        {formatEventTimestamp(item.timestamp)}
      </span>
    </>
  );

  if (item.href) {
    return (
      <li
        className="activity-enter py-1"
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <Link
          href={item.href}
          className="focus-ring flex min-h-12 items-start gap-4 rounded-2xl p-2 transition-colors hover:bg-white/[0.03]"
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li
      className="activity-enter flex min-h-12 items-start gap-4 py-1"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {content}
    </li>
  );
}

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
        <ActivityListItem key={item.id} item={item} index={index} />
      ))}
    </ul>
  );
}
