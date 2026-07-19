"use client";

import { formatCurrency } from "@/lib/finance/format";
import { cn } from "@/components/ui/cn";
import { CHART_COLORS } from "./constants";

export type DonutSegment = {
  label: string;
  value: number;
  percent: number;
  color?: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  emptyMessage?: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
  compact?: boolean;
  maxLegendItems?: number;
};

function polarToCartesian(
  center: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function describeArc(
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(center, radius, endAngle);
  const end = polarToCartesian(center, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArc,
    0,
    end.x,
    end.y,
  ].join(" ");
}

export function DonutChart({
  segments,
  emptyMessage = "No data yet",
  className,
  size,
  strokeWidth,
  compact = false,
  maxLegendItems,
}: DonutChartProps) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  const resolvedSize = size ?? (compact ? 56 : 120);
  const resolvedStroke = strokeWidth ?? (compact ? 8 : 14);
  const center = resolvedSize / 2;
  const radius = (resolvedSize - resolvedStroke) / 2;
  const legendItems =
    maxLegendItems === undefined
      ? compact
        ? []
        : visible
      : visible.slice(0, maxLegendItems);

  if (visible.length === 0 || total <= 0) {
    return (
      <p
        className={cn(
          compact ? "py-2 text-xs" : "py-6 text-sm",
          "text-center text-[var(--text-muted)]",
          className,
        )}
      >
        {emptyMessage}
      </p>
    );
  }

  let currentAngle = 0;

  return (
    <div
      className={cn(
        compact
          ? "flex items-center gap-3"
          : "flex flex-col gap-5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div
        className="relative shrink-0"
        style={{ width: resolvedSize, height: resolvedSize }}
      >
        <svg
          width={resolvedSize}
          height={resolvedSize}
          viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}
          aria-hidden
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--surface-border)"
            strokeWidth={resolvedStroke}
          />
          {visible.map((segment, index) => {
            const sweep = (segment.value / total) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sweep;
            currentAngle = endAngle;
            const color =
              segment.color ??
              CHART_COLORS.palette[index % CHART_COLORS.palette.length];

            if (sweep >= 359.9) {
              return (
                <circle
                  key={segment.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={resolvedStroke}
                />
              );
            }

            return (
              <path
                key={segment.label}
                d={describeArc(center, radius, startAngle, endAngle)}
                fill="none"
                stroke={color}
                strokeWidth={resolvedStroke}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>

      {legendItems.length > 0 ? (
        <ul className="min-w-0 flex-1 space-y-2">
          {legendItems.map((segment, index) => {
            const color =
              segment.color ??
              CHART_COLORS.palette[index % CHART_COLORS.palette.length];

            return (
              <li
                key={segment.label}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate text-sm text-[var(--text-secondary)]">
                    {segment.label}
                  </span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                  {formatCurrency(segment.value)} · {Math.round(segment.percent)}%
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
