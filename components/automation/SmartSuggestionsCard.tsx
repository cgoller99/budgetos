"use client";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { AutomationSuggestionActions } from "@/components/automation/AutomationSuggestionActions";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/components/ui/cn";

export function SmartSuggestionsCard() {
  const {
    automationSuggestions,
    dismissAutomationSuggestion,
    dismissAutomationSuggestionPermanently,
    completeAutomationSuggestion,
  } = useFinance();

  if (automationSuggestions.length === 0) {
    return null;
  }

  return (
    <Card padding="lg" hover>
      <CardHeader
        title="Smart suggestions"
        description="Personalized recommendations based on your money."
      />
      <CardContent className="space-y-4">
        {automationSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden>
                {suggestion.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-base font-medium",
                    suggestion.tone === "positive"
                      ? "text-emerald-400/90"
                      : suggestion.tone === "negative"
                        ? "text-rose-300/90"
                        : suggestion.tone === "accent"
                          ? "text-[#0077ed]"
                          : "text-[var(--foreground)]",
                  )}
                >
                  {suggestion.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
                  {suggestion.description}
                </p>
                <AutomationSuggestionActions
                  suggestion={suggestion}
                  compact
                  className="mt-4"
                  onPrimary={(item) => void completeAutomationSuggestion(item)}
                  onSecondary={(item) => dismissAutomationSuggestion(item.id)}
                  onTertiary={(item) =>
                    void dismissAutomationSuggestionPermanently(item)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
