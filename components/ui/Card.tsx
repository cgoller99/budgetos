import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import {
  cardBaseClassName,
  cardHoverClassName,
  cardPaddingClassName,
  cardPaddingLgClassName,
  cardSubtleHoverClassName,
  panelDescriptionClassName,
  panelTitleClassName,
} from "./tokens";

type CardVariant = "default" | "dashed" | "subtle" | "ghost";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  hover?: boolean;
  padding?: "default" | "lg" | "none";
  variant?: CardVariant;
};

const variantClasses: Record<CardVariant, string> = {
  default: cardBaseClassName,
  dashed:
    "rounded-[1.35rem] border border-dashed border-[var(--surface-border-strong)] bg-transparent shadow-none transition-all duration-300 ease-out",
  subtle:
    "rounded-[1.35rem] border border-[var(--surface-border)] bg-[var(--surface-subtle)] shadow-[var(--card-shadow)] transition-all duration-300 ease-out",
  ghost: "rounded-[1.35rem] border border-transparent bg-transparent",
};

const paddingClasses = {
  default: cardPaddingClassName,
  lg: cardPaddingLgClassName,
  none: "",
};

export function Card({
  children,
  hover = false,
  padding = "default",
  variant = "default",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        variantClasses[variant],
        paddingClasses[padding],
        hover && variant === "default" && cardHoverClassName,
        hover && variant === "subtle" && cardSubtleHoverClassName,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
};

export function CardHeader({
  title,
  description,
  className,
  action,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className={panelTitleClassName}>{title}</h2>
        {description && (
          <p className={panelDescriptionClassName}>{description}</p>
        )}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  );
}

type CardContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
