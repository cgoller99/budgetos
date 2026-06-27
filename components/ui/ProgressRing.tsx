import type { ReactNode } from "react";
import { cn } from "./cn";

type ProgressRingProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: ReactNode;
};

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ProgressRing({
  value,
  size = 112,
  strokeWidth = 8,
  className,
  children,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(value, 100));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        className="h-full w-full -rotate-90"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          stroke="#0077ed"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
