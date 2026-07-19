"use client";

import { useId, useState, type ReactNode } from "react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { cn } from "@/components/ui/cn";

type ExpandableCardProps = {
  title: string;
  headerAction?: ReactNode;
  summary: ReactNode;
  children: ReactNode;
  insights?: ReactNode;
  className?: string;
  expandLabel?: string;
  collapseLabel?: string;
};

export function ExpandableCard({
  title,
  headerAction,
  summary,
  children,
  insights,
  className,
  expandLabel = "Show more",
  collapseLabel = "Show less",
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <Card hover variant="subtle" padding="compact" className={className}>
      <CardHeader
        title={title}
        action={headerAction}
        className="mb-3"
      />
      <CardContent className="space-y-3">
        <div
          className={cn(
            "transition-opacity duration-[250ms] ease-out",
            expanded ? "pointer-events-none h-0 overflow-hidden opacity-0" : "opacity-100",
          )}
          aria-hidden={expanded}
        >
          {summary}
        </div>

        <div
          id={contentId}
          className={cn(
            "expandable-panel grid transition-[grid-template-rows,opacity] duration-[250ms] ease-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-4 pt-1">{children}</div>
            {insights ? (
              <div className="mt-4 border-t border-[var(--surface-border)] pt-4">
                {insights}
              </div>
            ) : null}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          fullWidth
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((current) => !current)}
          className="text-[var(--text-muted)] hover:text-[var(--foreground)]"
        >
          {expanded ? collapseLabel : expandLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
