import type { ReactNode } from "react";
import { cn } from "./cn";
import { iconBadgeClassName } from "./tokens";

type IconBadgeProps = {
  children: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "purple" | "neutral";
  className?: string;
};

const toneClasses: Record<NonNullable<IconBadgeProps["tone"]>, string> = {
  accent: "bg-[var(--accent-muted)] text-[var(--accent-light)]",
  success: "bg-[var(--success-muted)] text-[var(--success)]",
  warning: "bg-[var(--warning-muted)] text-[var(--warning)]",
  danger: "bg-[var(--danger-muted)] text-[var(--danger)]",
  purple: "bg-[var(--purple-muted)] text-[var(--purple)]",
  neutral: "bg-[var(--surface-hover)] text-[var(--text-muted)]",
};

export function IconBadge({
  children,
  tone = "accent",
  className,
}: IconBadgeProps) {
  return (
    <span className={cn(iconBadgeClassName, toneClasses[tone], className)}>
      {children}
    </span>
  );
}
