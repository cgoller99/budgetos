"use client";

import { useFinance } from "@/context/FinanceContext";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

export function FinanceSyncAlert() {
  const { error, isSyncing } = useFinance();
  const nativeIos = useNativeIos();

  if (!error && !isSyncing) {
    return null;
  }

  return (
    <div className={cn("mb-6 space-y-3", nativeIos && "mb-3 space-y-2")}>
      {error && (
        <p
          role="alert"
          className={cn(
            "rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300",
            nativeIos && "rounded-[10px] border-0 px-3.5 py-2.5 text-[13px]",
          )}
        >
          {error}
        </p>
      )}
      {isSyncing && (
        <p
          className={cn(
            "rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/45",
            nativeIos && "rounded-[10px] border-0 px-3.5 py-2.5 text-[13px]",
          )}
        >
          Syncing…
        </p>
      )}
    </div>
  );
}
