import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import {
  cardBaseClassName,
  cardHoverClassName,
  cardPaddingClassName,
  cardPaddingCompactClassName,
  cardPaddingLgClassName,
  cardSubtleHoverClassName,
  panelDescriptionClassName,
  panelTitleClassName,
} from "./tokens";

type CardVariant = "default" | "dashed" | "subtle" | "ghost";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  hover?: boolean;
  padding?: "default" | "lg" | "compact" | "none";
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
  compact: cardPaddingCompactClassName,
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
        "mb-5 flex items-center justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className={panelTitleClassName}>{title}</h2>
        {description ? (
          <p className={panelDescriptionClassName}>{description}</p>
        ) : null}
      </div>
      {action}
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
