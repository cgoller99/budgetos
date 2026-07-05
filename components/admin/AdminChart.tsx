"use client";

import { useState } from "react";
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const max = Math.max(...points.map((point) => point.value), 1);
  const hasData = points.some((point) => point.value > 0);

  if (points.length === 0 || !hasData) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5",
          className,
        )}
        role="img"
        aria-label={`${title} chart — no data yet`}
      >
        <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
        <div className="flex h-32 flex-col items-center justify-center gap-2 py-4">
          <span className="text-2xl opacity-40" aria-hidden>
            📊
          </span>
          <p className="text-sm text-[var(--text-muted)]">
            Data will appear here as activity grows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "timeline-chart-enter rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5",
        className,
      )}
      role="img"
      aria-label={`${title} bar chart`}
    >
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>

      {hoveredIndex !== null && points[hoveredIndex] && (
        <p
          className="mt-2 text-xs tabular-nums text-[#4da3ff] transition-opacity"
          aria-live="polite"
        >
          {points[hoveredIndex].date}: {valuePrefix}
          {points[hoveredIndex].value.toLocaleString()}
        </p>
      )}

      <div className="relative mt-5 flex h-32 items-end gap-1.5">
        {points.map((point, index) => {
          const heightPercent = Math.max(6, (point.value / max) * 100);
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={point.date}
              className="group flex flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-full w-full items-end justify-center">
                <button
                  type="button"
                  className={cn(
                    "w-full max-w-10 rounded-t-lg bg-gradient-to-t from-[#0077ed]/25 to-[#0077ed]/75 transition-all duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077ed]/50",
                    isHovered && "from-[#0077ed]/40 to-[#4da3ff] shadow-[0_0_16px_rgba(0,119,237,0.25)]",
                  )}
                  style={{ height: `${heightPercent}%` }}
                  aria-label={`${point.date}: ${valuePrefix}${point.value.toLocaleString()}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                />
              </div>
              <span className="hidden text-[10px] tabular-nums text-[var(--text-subtle)] sm:block">
                {point.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
