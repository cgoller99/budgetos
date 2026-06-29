"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import { cn } from "./cn";
import { metricLabelClassName, metricValueClassName } from "./tokens";

type StatCardProps = {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  mutedChange?: boolean;
  variant?: "card" | "inline";
  className?: string;
  tooltip?: ReactNode;
};

export function StatCard({
  label,
  value,
  change,
  positive = true,
  mutedChange = false,
  variant = "card",
  className,
  tooltip,
}: StatCardProps) {
  const previousValue = useRef(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (previousValue.current === value) {
      return;
    }

    previousValue.current = value;
    setIsAnimating(true);

    const timeout = window.setTimeout(() => setIsAnimating(false), 650);
    return () => window.clearTimeout(timeout);
  }, [value]);

  const content = (
    <>
      <div className="flex items-center gap-2">
        <p className={metricLabelClassName}>{label}</p>
        {tooltip}
      </div>
      <p
        className={cn(
          "mt-3 tracking-tight tabular-nums",
          variant === "inline"
            ? "text-2xl font-semibold text-[var(--foreground)] sm:text-3xl"
            : metricValueClassName,
          isAnimating && "kpi-value-animate text-[var(--foreground)]",
        )}
      >
        {value}
      </p>
      {change && (
        <p
          className={cn(
            "mt-2.5 text-sm leading-snug tabular-nums",
            mutedChange
              ? "text-[var(--text-muted)]"
              : positive
                ? "text-[#4da3ff]/90"
                : "text-rose-400/90",
          )}
        >
          {change}
        </p>
      )}
    </>
  );

  if (variant === "inline") {
    return <div>{content}</div>;
  }

  return (
    <Card
      hover
      variant="subtle"
      className={cn(
        "h-full",
        isAnimating &&
          "border-[#0077ed]/25 shadow-[0_2px_4px_rgba(0,0,0,0.24),0_16px_40px_rgba(0,119,237,0.12)]",
        className,
      )}
    >
      {content}
    </Card>
  );
}
