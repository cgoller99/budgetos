"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IosAvatar,
  IosCard,
  IosHeroMetric,
  IosIconButton,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
  IosSegmentedControl,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { AddIncomeModal } from "@/components/income/AddIncomeModal";
import { DeleteIncomeModal } from "@/components/income/DeleteIncomeModal";
import { EditIncomeModal } from "@/components/income/EditIncomeModal";
import { IncomePlanContent } from "@/components/incomePlan/IncomePlanContent";
import { IncomeLedgerPanel } from "@/components/income/IncomeLedgerPanel";
import { IncomeForecastPanel } from "@/components/income/IncomeForecastPanel";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  getIncomeDashboardSummary,
  getIncomeTableRows,
} from "@/lib/finance/income";
import type { IncomeSource } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";

type IncomeTab = "sources" | "plan" | "more";

export function IosIncomeScreen() {
  const finance = useFinance();
  const { markIncomeReceived, isLoading } = finance;
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: IncomeTab =
    tabParam === "plan" ? "plan" : tabParam === "history" || tabParam === "forecast"
      ? "more"
      : "sources";
  const [tab, setTab] = useState<IncomeTab>(initialTab);
  const [details, setDetails] = useState<"history" | "forecast" | null>(
    tabParam === "forecast" ? "forecast" : tabParam === "history" ? "history" : null,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editIncomeId, setEditIncomeId] = useState<string | null>(null);
  const [deleteIncomeId, setDeleteIncomeId] = useState<string | null>(null);

  const summary = useMemo(() => getIncomeDashboardSummary(finance), [finance]);
  const rows = useMemo(() => getIncomeTableRows(finance), [finance]);

  function setIncomeTab(next: IncomeTab) {
    void triggerHaptic("selection");
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "plan") {
      params.set("tab", "plan");
    } else if (next === "more") {
      params.set("tab", details ?? "history");
    } else {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(query ? `/income?${query}` : "/income");
  }

  if (isLoading) {
    return <IosSkeletonScreen rows={5} />;
  }

  function findIncome(id: string): IncomeSource | null {
    if (id.startsWith("__buxme_income_plan__")) return null;
    return finance.income.find((source) => source.id === id) ?? null;
  }

  const editIncome = editIncomeId ? findIncome(editIncomeId) : null;
  const deleteIncome = deleteIncomeId ? findIncome(deleteIncomeId) : null;

  return (
    <IosScreen>
      <div className="flex items-start justify-between gap-3">
        <IosHeroMetric
          label="Monthly income"
          value={formatCurrency(summary.monthlyIncome)}
          hint={
            summary.nextPaycheck
              ? `Next: ${summary.nextPaycheck.name} · ${summary.nextPaycheck.formattedDate}`
              : `${summary.activeSourceCount} active source${summary.activeSourceCount === 1 ? "" : "s"}`
          }
          tone="positive"
        />
        <IosIconButton
          label="Add income"
          onClick={() => {
            void triggerHaptic("light");
            setIsCreateOpen(true);
          }}
        >
          <span className="text-xl leading-none">+</span>
        </IosIconButton>
      </div>

      {summary.nextPaycheck ? (
        <IosCard padding="md" className="border-[var(--success)]/20 bg-[var(--success)]/10">
          <p className="text-[12px] font-medium text-[var(--success)]">Next paycheck</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="text-[17px] font-semibold text-[var(--foreground)]">
                {summary.nextPaycheck.name}
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">
                {summary.nextPaycheck.formattedDate}
              </p>
            </div>
            <p className="text-[18px] font-semibold tabular-nums text-[var(--success)]">
              +{formatCurrency(summary.nextPaycheck.amount)}
            </p>
          </div>
        </IosCard>
      ) : null}

      <IosSegmentedControl
        value={tab}
        onChange={setIncomeTab}
        options={[
          { value: "sources", label: "Sources" },
          { value: "plan", label: "Plan" },
          { value: "more", label: "More" },
        ]}
      />

      {tab === "sources" ? (
        rows.length === 0 ? (
          <IosList>
            <IosListRow
              title="Add an income source"
              subtitle="Paychecks show up on Home automatically"
              leading={<IosAvatar fallback="+" tone="success" />}
              onClick={() => setIsCreateOpen(true)}
              trailing={<span className="text-[var(--accent-light)]">›</span>}
            />
          </IosList>
        ) : (
          <IosSection title="Sources">
            <IosList>
              {rows.map((row) => (
                <IosListRow
                  key={row.id}
                  title={row.name}
                  subtitle={`${row.frequencyLabel} · ${row.statusLabel}`}
                  leading={
                    <IosAvatar
                      fallback={row.name.slice(0, 1).toUpperCase()}
                      tone={row.isActive ? "success" : "muted"}
                    />
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[var(--success)]">
                        {formatCurrency(row.amount)}
                      </span>
                      {row.canMarkReceived ? (
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-[var(--accent-light)]"
                          onClick={() => {
                            void markIncomeReceived(row.id).then(() => {
                              void triggerHaptic("success");
                              showToast({
                                title: `${row.name} received`,
                                type: "success",
                              });
                            });
                          }}
                        >
                          Mark received
                        </button>
                      ) : null}
                    </div>
                  }
                  onClick={() => setEditIncomeId(row.id)}
                />
              ))}
            </IosList>
          </IosSection>
        )
      ) : null}

      {tab === "plan" ? (
        <div className="ios-embedded-panel [&_.page-header]:hidden [&_h1]:text-[17px] [&_h2]:text-[15px]">
          <IncomePlanContent embedded />
        </div>
      ) : null}

      {tab === "more" ? (
        <IosSection title="Details">
          <IosList>
            <IosListRow
              title="Allocation history"
              subtitle="Past paycheck runs"
              leading={<IosAvatar fallback="H" tone="accent" />}
              onClick={() => setDetails(details === "history" ? null : "history")}
              trailing={
                <span className="text-[var(--accent-light)]">
                  {details === "history" ? "Hide" : "View"}
                </span>
              }
            />
            <IosListRow
              title="Income forecast"
              subtitle="Projected cash flow"
              leading={<IosAvatar fallback="F" tone="warning" />}
              onClick={() => setDetails(details === "forecast" ? null : "forecast")}
              trailing={
                <span className="text-[var(--accent-light)]">
                  {details === "forecast" ? "Hide" : "View"}
                </span>
              }
            />
          </IosList>
          {details === "history" ? (
            <div className="ios-embedded-panel mt-3">
              <IncomeLedgerPanel />
            </div>
          ) : null}
          {details === "forecast" ? (
            <div className="ios-embedded-panel mt-3">
              <IncomeForecastPanel />
            </div>
          ) : null}
          <div className="mt-2 flex justify-end">
            <IosTextButton onClick={() => setIncomeTab("plan")}>
              Open paycheck plan
            </IosTextButton>
          </div>
        </IosSection>
      ) : null}

      <AddIncomeModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <EditIncomeModal income={editIncome} onClose={() => setEditIncomeId(null)} />
      <DeleteIncomeModal income={deleteIncome} onClose={() => setDeleteIncomeId(null)} />
    </IosScreen>
  );
}
