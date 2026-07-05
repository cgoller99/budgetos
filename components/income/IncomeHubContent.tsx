"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { IncomeForecastPanel } from "@/components/income/IncomeForecastPanel";
import { IncomeContent } from "@/components/income/IncomeContent";
import { IncomeLedgerPanel } from "@/components/income/IncomeLedgerPanel";
import { IncomePlanContent } from "@/components/incomePlan/IncomePlanContent";
import { cn } from "@/components/ui/cn";
import { pageContainerWideClassName } from "@/components/ui/tokens";

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "plan", label: "Paycheck plan" },
  { id: "history", label: "History" },
  { id: "forecast", label: "Forecast" },
] as const;

type IncomeTab = (typeof TABS)[number]["id"];

function isIncomeTab(value: string | null): value is IncomeTab {
  return TABS.some((tab) => tab.id === value);
}

export function IncomeHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const activeTab: IncomeTab = isIncomeTab(tabParam) ? tabParam : "sources";

  function setTab(tab: IncomeTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "sources") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.replace(query ? `/income?${query}` : "/income");
  }

  return (
    <div className={cn(pageContainerWideClassName, "space-y-6")}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Cash Flow
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Income
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Paychecks, your plan, allocation history, and forecasts — all in one
          place. Plans run automatically on your schedule.
        </p>
      </div>

      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1"
        role="tablist"
        aria-label="Income sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "focus-ring min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-[#0077ed]/20 text-[#4da3ff]"
                : "text-[var(--text-muted)] hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "sources" ? <IncomeContent embedded /> : null}
        {activeTab === "plan" ? <IncomePlanContent embedded /> : null}
        {activeTab === "history" ? <IncomeLedgerPanel /> : null}
        {activeTab === "forecast" ? <IncomeForecastPanel /> : null}
      </div>
    </div>
  );
}
