"use client";

import { cn } from "@/components/ui/cn";

type SparklineProps = {
  values: number[];
  color?: string;
  className?: string;
  width?: number;
  height?: number;
};

function buildSparklinePath(
  values: number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values.map((value, index) => {
    const x =
      padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y =
      padding +
      (height - padding * 2) -
      ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlX = (previous.x + current.x) / 2;
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

export function Sparkline({
  values,
  color = "var(--accent)",
  className,
  width = 72,
  height = 28,
}: SparklineProps) {
  const path = buildSparklinePath(values, width, height);

  if (!path) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      width={width}
      height={height}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
