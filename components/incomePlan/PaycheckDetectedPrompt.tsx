"use client";

import { useMemo } from "react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { AutomationSuggestion } from "@/lib/automation/types";
import { formatCurrency } from "@/lib/finance/format";

type PaycheckDetectedPromptProps = {
  suggestion: AutomationSuggestion;
  onDismiss: () => void;
};

export function PaycheckDetectedPrompt({
  suggestion,
  onDismiss,
}: PaycheckDetectedPromptProps) {
  const finance = useFinance();
  const { showToast } = useToast();

  const paycheckAmount = useMemo(
    () => finance.incomePlan?.paycheckAmount ?? 0,
    [finance.incomePlan?.paycheckAmount],
  );

  async function handleApply() {
    try {
      await finance.runIncomePlan();
      showToast({
        title: "Income Plan applied",
        subtitle: "Allocations moved to your envelopes.",
        type: "success",
      });
      onDismiss();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Card padding="lg" className="border-[#0077ed]/30 bg-[#0077ed]/5">
      <CardHeader
        title={suggestion.title}
        description={suggestion.description}
      />
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">
          Buxme detected a deposit of{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {formatCurrency(paycheckAmount)}
          </span>
          . Apply your planned allocations automatically?
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleApply()} disabled={finance.isSyncing}>
            Apply
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Skip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaycheckDetectedPromptList() {
  const finance = useFinance();
  const paycheckSuggestions = finance.automationSuggestions.filter(
    (item) => item.kind === "paycheck_detected",
  );

  if (paycheckSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {paycheckSuggestions.map((suggestion) => (
        <PaycheckDetectedPrompt
          key={suggestion.id}
          suggestion={suggestion}
          onDismiss={() => finance.dismissAutomationSuggestion(suggestion.id)}
        />
      ))}
    </div>
  );
}
