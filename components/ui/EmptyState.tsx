import type { ReactNode } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { cn } from "./cn";

type EmptyStateProps = {
  title: string;
  description: string;
  nextSteps?: string[];
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  nextSteps,
  actionLabel,
  onAction,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card variant="dashed" padding="lg" className={cn("text-center", className)}>
      <p className="text-lg font-medium text-[var(--foreground)]">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[var(--text-muted)]">
        {description}
      </p>
      {nextSteps && nextSteps.length > 0 && (
        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-[var(--text-secondary)]">
          {nextSteps.map((step) => (
            <li key={step} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#0077ed]" />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      )}
      {action}
      {!action && actionLabel && onAction && (
        <div className="mt-8 flex justify-center">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </Card>
  );
}
