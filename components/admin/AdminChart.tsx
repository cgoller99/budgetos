"use client";

import { cn } from "@/components/ui/cn";

type AdminChartProps = {
  title: string;
  points: Array<{ date: string; value: number }>;
  valuePrefix?: string;
  className?: string;
};

export function AdminChart({
  title,
  points,
  valuePrefix = "",
  className,
}: AdminChartProps) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5",
        className,
      )}
    >
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      <div className="mt-5 flex h-32 items-end gap-1">
        {points.map((point) => (
          <div key={point.date} className="group flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-[#0077ed]/30 to-[#0077ed]/80 transition-all group-hover:to-[#4da3ff]"
              style={{ height: `${Math.max(6, (point.value / max) * 100)}%` }}
              title={`${point.date}: ${valuePrefix}${point.value}`}
            />
            <span className="hidden text-[10px] text-[var(--text-subtle)] sm:block">
              {point.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
