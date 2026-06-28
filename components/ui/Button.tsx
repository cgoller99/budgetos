import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { buttonPrimaryClassName } from "./tokens";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: buttonPrimaryClassName,
  secondary:
    "border border-white/[0.06] bg-white/[0.025] text-white/75 hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-white active:scale-[0.98]",
  ghost:
    "border border-transparent bg-transparent text-white/65 hover:bg-white/[0.04] hover:text-white active:scale-[0.98]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-10 rounded-2xl px-4 py-2.5 text-sm",
  md: "min-h-11 rounded-2xl px-5 py-3 text-base",
  lg: "min-h-12 rounded-2xl px-6 py-3.5 text-base",
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
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-50",
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
