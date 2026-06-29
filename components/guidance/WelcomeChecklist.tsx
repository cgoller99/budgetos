"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  dismissWelcomeChecklist,
  isWelcomeChecklistDismissed,
} from "@/lib/guidance/checklist";

const CHECKLIST_ITEMS = [
  "Add accounts so balances have a home.",
  "Add income and bills to unlock cash flow.",
  "Set one savings goal to make progress visible.",
];

export function WelcomeChecklist() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    setIsDismissed(isWelcomeChecklistDismissed());
  }, []);

  function handleDismiss() {
    dismissWelcomeChecklist();
    setIsDismissed(true);
  }

  if (isDismissed) {
    return null;
  }

  return (
    <Card padding="default" className="border-[#0077ed]/20 bg-[#0077ed]/8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[var(--foreground)]">
            Welcome to Buxme
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            Start with the basics. You can come back to each area anytime.
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
            {CHECKLIST_ITEMS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#0077ed]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
