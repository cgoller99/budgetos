import type { ReactNode } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { cn } from "./cn";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card variant="dashed" padding="lg" className={cn("text-center", className)}>
      <p className="text-lg font-medium text-white/75">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-white/38">
        {description}
      </p>
      {action}
      {!action && actionLabel && onAction && (
        <div className="mt-8 flex justify-center">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </Card>
  );
}
