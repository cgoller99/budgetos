"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  dismissWelcomeChecklist,
  isWelcomeChecklistDismissed,
} from "@/lib/guidance/checklist";

const CHECKLIST_ITEMS = [
  "Add accounts",
  "Add income & bills",
  "Set a savings goal",
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
    <Card padding="compact" variant="subtle" className="border-[#0077ed]/20 bg-[#0077ed]/6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
          {CHECKLIST_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-[#0077ed]" />
              {item}
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
