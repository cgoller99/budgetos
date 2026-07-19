"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import { cn } from "./cn";
import {
  metricChangeClassName,
  metricLabelClassName,
  metricValueClassName,
} from "./tokens";

type StatCardProps = {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  mutedChange?: boolean;
  variant?: "card" | "inline";
  className?: string;
  tooltip?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
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
  icon,
  trailing,
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={metricLabelClassName}>{label}</p>
            {tooltip}
          </div>
          <p
            className={cn(
              "mt-1.5 tracking-tight tabular-nums",
              variant === "inline"
                ? "text-2xl font-semibold text-[var(--foreground)] sm:text-3xl"
                : metricValueClassName,
              isAnimating && "kpi-value-animate text-[var(--foreground)]",
            )}
          >
            {value}
          </p>
          {change ? (
            <p
              className={cn(
                metricChangeClassName,
                !mutedChange &&
                  (positive
                    ? "text-[var(--success)]"
                    : "text-[var(--danger)]"),
              )}
            >
              {change}
            </p>
          ) : null}
        </div>
        {icon ? <div className="shrink-0">{icon}</div> : null}
      </div>
      {trailing ? <div className="mt-3">{trailing}</div> : null}
    </>
  );

  if (variant === "inline") {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card
      hover
      variant="subtle"
      padding="compact"
      className={cn(
        "h-full",
        isAnimating && "border-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
        className,
      )}
    >
      {content}
    </Card>
  );
}
