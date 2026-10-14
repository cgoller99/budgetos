"use client";

import type { CategoryBudgetSyncStatus } from "@/lib/budgets/categoryBudgetSync";

export function CategoryBudgetStatus({
  status,
  message,
  onRetry,
}: {
  status: CategoryBudgetSyncStatus;
  message: string | null;
  onRetry: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-[13px] leading-snug text-[var(--text-muted)]" role="status">
      {message}
      {status === "error" || status === "offline" ? (
        <>
          {" "}
          <button
            type="button"
            className="font-semibold text-[var(--accent-light)]"
            onClick={onRetry}
          >
            Try again
          </button>
        </>
      ) : null}
    </p>
  );
}
