import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import {
  cardBaseClassName,
  cardHoverClassName,
  cardPaddingClassName,
  cardPaddingLgClassName,
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
    "rounded-[1.35rem] border border-dashed border-white/[0.07] bg-transparent shadow-none transition-all duration-300 ease-out",
  subtle:
    "rounded-[1.35rem] border border-white/[0.04] bg-white/[0.02] shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out",
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
        "mb-7 flex items-start justify-between gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className={panelTitleClassName}>{title}</h2>
        {description && (
          <p className={panelDescriptionClassName}>{description}</p>
        )}
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
