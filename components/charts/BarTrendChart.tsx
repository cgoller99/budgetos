"use client";

import { formatCurrency } from "@/lib/finance/format";
import { cn } from "@/components/ui/cn";
import { CHART_COLORS } from "./constants";

export type BarTrendPoint = {
  key: string;
  label: string;
  value: number;
};

type BarTrendChartProps = {
  points: BarTrendPoint[];
  color?: string;
  emptyMessage?: string;
  className?: string;
  barClassName?: string;
  compact?: boolean;
};

function getMaxValue(points: BarTrendPoint[]): number {
  return Math.max(...points.map((point) => point.value), 1);
}

export function BarTrendChart({
  points,
  color = CHART_COLORS.primary,
  emptyMessage = "No data yet",
  className,
  barClassName,
  compact = false,
}: BarTrendChartProps) {
  const hasData = points.some((point) => point.value > 0);
  const maxValue = getMaxValue(points);
  const barHeight = compact ? "h-14" : "h-28";

  if (!hasData) {
    return (
      <p
        className={cn(
          compact ? "py-2 text-xs" : "py-8 text-sm",
          "text-center text-[var(--text-muted)]",
          className,
        )}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      className={cn("flex items-end justify-between gap-2 pt-1", className)}
      role="img"
      aria-label="Trend chart"
    >
      {points.map((point) => {
        const heightPercent = maxValue > 0 ? (point.value / maxValue) * 100 : 0;

        return (
          <div
            key={point.key}
            className="group flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span className="text-[10px] tabular-nums text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {point.value > 0 ? formatCurrency(point.value) : "—"}
            </span>
            <div className={cn("flex w-full items-end justify-center", barHeight, barClassName)}>
              <div
                className="w-full max-w-9 rounded-t-xl transition-all duration-500 ease-out"
                style={{
                  height: `${Math.max(heightPercent, point.value > 0 ? 8 : 0)}%`,
                  backgroundImage: `linear-gradient(to top, ${color}44, ${color})`,
                  opacity: point.value > 0 ? 1 : 0.12,
                }}
                title={`${point.label}: ${point.value > 0 ? formatCurrency(point.value) : "—"}`}
              />
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}
