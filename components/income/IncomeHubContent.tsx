"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IncomeForecastPanel } from "@/components/income/IncomeForecastPanel";
import { IncomeContent } from "@/components/income/IncomeContent";
import { IncomeLedgerPanel } from "@/components/income/IncomeLedgerPanel";
import { IncomePlanContent } from "@/components/incomePlan/IncomePlanContent";
import { NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { cn } from "@/components/ui/cn";
import { pageContainerWideClassName } from "@/components/ui/tokens";

const DESKTOP_TABS = [
  { id: "sources", label: "Sources" },
  { id: "plan", label: "Paycheck plan" },
  { id: "history", label: "History" },
  { id: "forecast", label: "Forecast" },
] as const;

const MOBILE_PRIMARY_TABS = [
  { id: "plan", label: "Paycheck plan" },
  { id: "sources", label: "Sources" },
] as const;

type IncomeTab = (typeof DESKTOP_TABS)[number]["id"];

function isIncomeTab(value: string | null): value is IncomeTab {
  return DESKTOP_TABS.some((tab) => tab.id === value);
}

export function IncomeHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const activeTab: IncomeTab = isIncomeTab(tabParam) ? tabParam : "sources";
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");

    function sync() {
      setIsMobile(media.matches);
    }

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isMobile || tabParam) {
      return;
    }

    router.replace("/income?tab=plan");
  }, [isMobile, router, tabParam]);

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

  const mobileActiveTab =
    activeTab === "plan" || activeTab === "sources" ? activeTab : "plan";

  return (
    <div className={cn(pageContainerWideClassName, "space-y-6")}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Cash Flow
        </p>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Paychecks, your plan, allocation history, and forecasts — all in one
          place. Plans run automatically on your schedule.
        </p>
      </div>

      {/* Mobile: paycheck plan first, secondary tabs collapsed */}
      <div className="space-y-4 lg:hidden">
        <NextPaycheckCard />

        <div
          className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1"
          role="tablist"
          aria-label="Income sections"
        >
          {MOBILE_PRIMARY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mobileActiveTab === tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "focus-ring min-h-11 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                mobileActiveTab === tab.id
                  ? "bg-[var(--accent)]/20 text-[var(--accent-light)]"
                  : "text-[var(--text-muted)] hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {mobileActiveTab === "plan" ? <IncomePlanContent embedded /> : null}
          {mobileActiveTab === "sources" ? <IncomeContent embedded /> : null}
        </div>

        <MobileCollapsibleSection
          title="Allocation history"
          description="Past paycheck runs and ledger entries"
        >
          <IncomeLedgerPanel />
        </MobileCollapsibleSection>

        <MobileCollapsibleSection
          title="Income forecast"
          description="Projected paychecks and cash flow"
        >
          <IncomeForecastPanel />
        </MobileCollapsibleSection>
      </div>

      {/* Desktop: full tabbed hub */}
      <div className="hidden lg:block">
        <div
          className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1 sm:grid-cols-4"
          role="tablist"
          aria-label="Income sections"
        >
          {DESKTOP_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "focus-ring min-h-11 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-[var(--accent)]/20 text-[var(--accent-light)]"
                  : "text-[var(--text-muted)] hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6" role="tabpanel">
          {activeTab === "sources" ? <IncomeContent embedded /> : null}
          {activeTab === "plan" ? <IncomePlanContent embedded /> : null}
          {activeTab === "history" ? <IncomeLedgerPanel /> : null}
          {activeTab === "forecast" ? <IncomeForecastPanel /> : null}
        </div>
      </div>
    </div>
  );
}
