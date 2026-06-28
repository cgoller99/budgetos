"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getDemoProfile } from "@/lib/demo/profiles";

export function DemoModeBanner() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isDemoMode, demoProfileId, exitDemoMode, isSyncing } = useFinance();
  const [isExiting, setIsExiting] = useState(false);

  if (!isDemoMode) {
    return null;
  }

  const profileName = demoProfileId
    ? getDemoProfile(demoProfileId).name
    : "sample profile";

  async function handleExitDemoMode() {
    const confirmed = window.confirm(
      "Exit demo mode? Sample accounts, bills, and goals will be removed. You'll start with your own empty Buxme workspace.",
    );

    if (!confirmed) {
      return;
    }

    setIsExiting(true);

    try {
      await exitDemoMode();
      showToast({
        title: "Demo mode exited",
        subtitle: "You're now viewing your own Buxme data.",
      });
      router.push("/dashboard");
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsExiting(false);
    }
  }

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#6366f1]/25 bg-[#6366f1]/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-semibold text-white">
          Demo mode is active
        </p>
        <p className="mt-1 text-sm text-white/55">
          You&apos;re exploring {profileName}&apos;s sample finances. Changes
          sync to your account but are not your real data.
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={() => void handleExitDemoMode()}
        disabled={isSyncing || isExiting}
        className="shrink-0"
      >
        {isExiting ? "Exiting..." : "Exit Demo Mode"}
      </Button>
    </div>
  );
}
