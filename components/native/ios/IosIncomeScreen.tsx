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
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
import { IncomePlanContent } from "@/components/incomePlan/IncomePlanContent";
import { IncomeLedgerPanel } from "@/components/income/IncomeLedgerPanel";
import { IncomeForecastPanel } from "@/components/income/IncomeForecastPanel";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import { describePaySchedule, formatPayDate } from "@/lib/incomePlan/payDates";
import { INCOME_PLAN_SCHEDULE_LABELS } from "@/lib/incomePlan/types";
import {
  getIncomeDashboardSummary,
  getIncomeTableRows,
} from "@/lib/finance/income";
import type { IncomeSource, IncomeTableRow } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";

type IncomeTab = "sources" | "plan" | "more";

function PaycheckPlan({
  finance,
  nextPaycheck,
  showEditor,
  onToggleEditor,
}: {
  finance: ReturnType<typeof useFinance>;
  nextPaycheck: {
    name: string;
    formattedDate: string;
    amount: number;
    daysUntil: number;
  } | null;
  showEditor: boolean;
  onToggleEditor: () => void;
}) {
  const plan = finance.incomePlan;
  const resolved = plan ? resolveAllocationAmounts(plan) : [];
  const allocated = resolved.reduce((sum, item) => sum + item.amount, 0);
  const remaining = plan ? Math.round((plan.paycheckAmount - allocated) * 100) / 100 : 0;

  if (!plan) {
    return (
      <div className="flex flex-col gap-3">
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            No paycheck plan yet
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Set a payday and split each check across bills, goals, and what’s left.
          </p>
        </IosCard>
        <IncomePlanContent embedded />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <IosCard padding="md">
        <p className="text-[12px] font-medium text-[var(--text-muted)]">Upcoming payday</p>
        <p className="mt-1 text-[20px] font-semibold text-[var(--foreground)]">
          {nextPaycheck?.formattedDate ?? formatPayDate(plan.nextPayDate)}
        </p>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {describePaySchedule(plan)} · {INCOME_PLAN_SCHEDULE_LABELS[plan.paySchedule]}
          {nextPaycheck
            ? nextPaycheck.daysUntil === 0
              ? " · Today"
              : nextPaycheck.daysUntil === 1
                ? " · Tomorrow"
                : ` · In ${nextPaycheck.daysUntil} days`
            : ""}
        </p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[13px] text-[var(--text-muted)]">Paycheck</p>
            <p className="text-[18px] font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(plan.paycheckAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-[var(--text-muted)]">
              {remaining < 0 ? "Over by" : "Left to assign"}
            </p>
            <p
              className={`text-[18px] font-semibold tabular-nums ${
                remaining < 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"
              }`}
            >
              {formatCurrency(Math.abs(remaining))}
            </p>
          </div>
        </div>
      </IosCard>
      <IosSection title="Allocations">
        {resolved.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[14px] text-[var(--text-muted)]">
              No allocations yet. Adjust the plan to split this paycheck.
            </p>
          </IosCard>
        ) : (
          <IosList>
            {resolved.map((item) => (
              <IosListRow
                key={item.allocation.id}
                title={item.allocation.name}
                subtitle={item.allocation.isRemainingBalance ? "Whatever is left" : "Each paycheck"}
                leading={<IosAvatar fallback={item.allocation.icon || item.allocation.name.slice(0, 1)} tone="success" />}
                trailing={formatCurrency(item.amount)}
              />
            ))}
          </IosList>
        )}
      </IosSection>
      <IosTextButton onClick={onToggleEditor}>
        {showEditor ? "Hide plan editor" : "Adjust plan"}
      </IosTextButton>
      {showEditor ? (
        <div className="ios-embedded-panel [&_.page-header]:hidden [&_h1]:text-[17px] [&_h2]:text-[15px]">
          <IncomePlanContent embedded />
        </div>
      ) : null}
    </div>
  );
}

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
  const [selectedSource, setSelectedSource] = useState<IncomeTableRow | null>(null);
  const [showPlanEditor, setShowPlanEditor] = useState(false);

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
        variant="pills"
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
          <IosCard padding="md">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              No income sources
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Add a paycheck so Home can show your next deposit and Plan can allocate it.
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white"
              onClick={() => {
                void triggerHaptic("light");
                setIsCreateOpen(true);
              }}
            >
              Add income
            </button>
          </IosCard>
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
                    <span className="text-[var(--success)]">
                      {formatCurrency(row.amount)}
                    </span>
                  }
                  onClick={() => {
                    void triggerHaptic("selection");
                    setSelectedSource(row);
                  }}
                />
              ))}
            </IosList>
          </IosSection>
        )
      ) : null}

      {tab === "plan" ? (
        <PaycheckPlan
          finance={finance}
          nextPaycheck={summary.nextPaycheck}
          showEditor={showPlanEditor}
          onToggleEditor={() => {
            void triggerHaptic("light");
            setShowPlanEditor((current) => !current);
          }}
        />
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

      <IosBottomSheet
        open={selectedSource !== null}
        title={selectedSource?.name}
        onClose={() => setSelectedSource(null)}
      >
        {selectedSource ? (
          <div>
            <p className="text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--success)]">
              {formatCurrency(selectedSource.amount)}
            </p>
            <p className="mt-2 text-center text-[13px] text-[var(--text-muted)]">
              {selectedSource.frequencyLabel} · {selectedSource.statusLabel}
            </p>
            <div className="mt-5 rounded-[16px] bg-white/[0.04] px-3.5 py-3 text-[14px] text-[var(--text-secondary)]">
              <p>Next pay {selectedSource.nextPayDate || "not scheduled"}</p>
              <p className="mt-1">Deposits to {selectedSource.depositAccountName || "unassigned"}</p>
            </div>
            <div className="mt-4 flex gap-2">
              {selectedSource.canMarkReceived ? (
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white"
                  onClick={() => {
                    void markIncomeReceived(selectedSource.id).then(() => {
                      void triggerHaptic("success");
                      showToast({
                        title: `${selectedSource.name} received`,
                        type: "success",
                      });
                      setSelectedSource(null);
                    });
                  }}
                >
                  Mark received
                </button>
              ) : null}
              <button
                type="button"
                className="min-h-12 flex-1 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--foreground)]"
                onClick={() => {
                  const source = findIncome(selectedSource.id);
                  setSelectedSource(null);
                  if (source) setEditIncomeId(source.id);
                }}
              >
                Edit
              </button>
            </div>
            {findIncome(selectedSource.id) ? (
              <button
                type="button"
                className="mt-2 min-h-12 w-full rounded-[14px] text-[16px] font-semibold text-[var(--danger)]"
                onClick={() => {
                  void triggerHaptic("light");
                  setDeleteIncomeId(selectedSource.id);
                  setSelectedSource(null);
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : null}
      </IosBottomSheet>
      <AddIncomeModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <EditIncomeModal income={editIncome} onClose={() => setEditIncomeId(null)} />
      <DeleteIncomeModal income={deleteIncome} onClose={() => setDeleteIncomeId(null)} />
    </IosScreen>
  );
}
