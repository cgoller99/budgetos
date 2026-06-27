"use client";

import { useFinance } from "@/context/FinanceContext";

export function FinanceSyncAlert() {
  const { error, isSyncing } = useFinance();

  if (!error && !isSyncing) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {error}
        </p>
      )}
      {isSyncing && (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/45">
          Syncing changes…
        </p>
      )}
    </div>
  );
}
