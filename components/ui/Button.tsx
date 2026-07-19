import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import {
  buttonDangerClassName,
  buttonGhostClassName,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  buttonTextClassName,
} from "./tokens";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "text";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: buttonPrimaryClassName,
  secondary: buttonSecondaryClassName,
  danger: buttonDangerClassName,
  ghost: buttonGhostClassName,
  text: buttonTextClassName,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-[var(--radius-button)] px-3.5 py-2 text-xs",
  md: "min-h-10 rounded-[var(--radius-button)] px-4 py-2.5 text-sm",
  lg: "min-h-11 rounded-[var(--radius-button)] px-5 py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "btn-press focus-ring inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full flex-1",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
