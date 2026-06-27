"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import { cn } from "./cn";
import { metricLabelClassName, metricValueClassName } from "./tokens";

type StatCardProps = {
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  variant?: "card" | "inline";
};

export function StatCard({
  label,
  value,
  change,
  positive = true,
  variant = "card",
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
      <p className={metricLabelClassName}>{label}</p>
      <p
        className={cn(
          "mt-3 tracking-tight tabular-nums",
          variant === "inline"
            ? "text-2xl font-semibold text-white sm:text-3xl"
            : metricValueClassName,
          isAnimating && "kpi-value-animate text-white",
        )}
      >
        {value}
      </p>
      {change && (
        <p
          className={cn(
            "mt-3 text-sm tabular-nums",
            positive ? "text-emerald-400/90" : "text-rose-400/90",
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
      variant="subtle"
      className={cn(
        isAnimating && "border-[#0077ed]/20",
      )}
    >
      {content}
    </Card>
  );
}
