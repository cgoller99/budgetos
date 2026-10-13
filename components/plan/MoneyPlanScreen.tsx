"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { IosCard, IosScreen, IosSection } from "@/components/native/ios/IosPrimitives";
import { MoneyPlanContent } from "@/components/plan/MoneyPlanContent";
import { MoneyPlanPreview } from "@/components/plan/MoneyPlanPreview";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { readSavedCategoryBudgets } from "@/lib/automation/savedBudgets";
import { useNativeIos } from "@/lib/native/useNativeIos";
import type { MoneyPlanAccess } from "@/lib/plan/moneyPlanAccess";
import type { MoneyPlan } from "@/lib/plan/moneyPlan";

function MoneyPlanMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const nativeIos = useNativeIos();
  const body = (
    <p className="text-[13px] leading-snug text-[var(--text-muted)]" role="status">
      {message}
      {onRetry ? (
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

  if (nativeIos) {
    return (
      <IosScreen>
        <IosSection title="Money Plan">
          <IosCard padding="md">{body}</IosCard>
        </IosSection>
      </IosScreen>
    );
  }

  return (
    <div className={pageContainerWideClassName}>
      <Card>
        <CardHeader title="Money Plan" description="Income, bills, debt, goals, and budgets." />
        <CardContent>{body}</CardContent>
      </Card>
    </div>
  );
}

export function MoneyPlanScreen({ access }: { access: MoneyPlanAccess }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"preview" | "loading" | "error" | "ready">(
    access === "full" ? "loading" : "preview",
  );
  const [plan, setPlan] = useState<MoneyPlan | null>(null);

  const load = useCallback(async () => {
    if (access !== "full") {
      setPlan(null);
      setStatus("preview");
      return;
    }

    setStatus("loading");
    try {
      const response = await fetch("/api/money-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgets: readSavedCategoryBudgets(user?.id),
        }),
      });
      const body = (await response.json()) as {
        access?: string;
        plan?: MoneyPlan;
      };

      if (response.status === 403 || body.access === "preview") {
        setPlan(null);
        setStatus("preview");
        return;
      }

      if (!response.ok || body.access !== "full" || !body.plan) {
        setPlan(null);
        setStatus("error");
        return;
      }

      setPlan(body.plan);
      setStatus("ready");
    } catch {
      setPlan(null);
      setStatus("error");
    }
  }, [access, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "preview") {
    return <MoneyPlanPreview />;
  }

  if (status === "loading" || !plan) {
    return (
      <MoneyPlanMessage
        message={
          status === "error"
            ? "Money Plan couldn't be loaded."
            : "Loading your Money Plan..."
        }
        onRetry={status === "error" ? () => void load() : undefined}
      />
    );
  }

  return <MoneyPlanContent plan={plan} />;
}
