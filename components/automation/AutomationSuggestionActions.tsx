"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import type { AutomationSuggestion } from "@/lib/automation/types";
import { cn } from "@/components/ui/cn";

type AutomationSuggestionActionsProps = {
  suggestion: AutomationSuggestion;
  onPrimary: (suggestion: AutomationSuggestion) => void;
  onSecondary?: (suggestion: AutomationSuggestion) => void;
  compact?: boolean;
  className?: string;
};

export function AutomationSuggestionActions({
  suggestion,
  onPrimary,
  onSecondary,
  compact = false,
  className,
}: AutomationSuggestionActionsProps) {
  const detailHref = suggestion.detailHref;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        size={compact ? "sm" : "md"}
        onClick={() => onPrimary(suggestion)}
      >
        {suggestion.primaryAction.label}
      </Button>
      {suggestion.secondaryAction && (
        <Button
          size={compact ? "sm" : "md"}
          variant="secondary"
          onClick={() => onSecondary?.(suggestion)}
        >
          {suggestion.secondaryAction.label}
        </Button>
      )}
      {detailHref && (
        <Link
          href={detailHref}
          className="text-sm text-[#0077ed] transition-colors hover:underline"
        >
          View details
        </Link>
      )}
    </div>
  );
}
