import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-white/[0.05] text-white/55",
  accent: "bg-[#0077ed]/12 text-[#0077ed]",
  success: "bg-emerald-400/10 text-emerald-400/90",
  warning: "bg-amber-400/10 text-amber-400/90",
  danger: "bg-rose-400/10 text-rose-400/90",
};

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
