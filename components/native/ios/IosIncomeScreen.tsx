"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IosAvatar,
  IosCard,
  IosDetailLine,
  IosDonut,
  IosHeroMetric,
  IosIconButton,
  IosList,
  IosListRow,
  IosScreen,
  IosPrimaryButton,
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
import { PaycheckDetectedPromptList } from "@/components/incomePlan/PaycheckDetectedPrompt";
import { IncomeLedgerPanel } from "@/components/income/IncomeLedgerPanel";
import { IncomeForecastPanel } from "@/components/income/IncomeForecastPanel";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { describeCashOutlook, forecastCashOutlook } from "@/lib/finance/cashOutlook";
import { formatCurrency } from "@/lib/finance/format";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import { advancePayDate, describePaySchedule, formatPayDate } from "@/lib/incomePlan/payDates";
import { INCOME_PLAN_SCHEDULE_LABELS } from "@/lib/incomePlan/types";
import {
  getIncomeDashboardSummary,
  getIncomeTableRows,
} from "@/lib/finance/income";
import type { IncomeSource, IncomeTableRow } from "@/lib/finance/types";
import { classifyUpcomingPaycheck } from "@/lib/automation/paycheckReview";
import { triggerHaptic } from "@/lib/native/haptics";

type IncomeTab = "upcoming" | "plan" | "sources" | "history";

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
  const paycheckState = classifyUpcomingPaycheck(finance);
  const paydayLabel =
    paycheckState.lifecycle === "received"
      ? "Received paycheck"
      : paycheckState.lifecycle === "applied"
        ? "Applied paycheck"
        : "Expected paycheck";
  const outlook = forecastCashOutlook(finance);
  const cashOutlook = describeCashOutlook(outlook);
  const showOutlook = outlook.availableCash !== 0 || outlook.events.length > 0;
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
      {!showEditor ? <PaycheckDetectedPromptList /> : null}
      <IosCard padding="md">
        <p className="text-[12px] font-medium text-[var(--text-muted)]">{paydayLabel}</p>
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
          {paycheckState.lifecycle === "expected"
            ? " · Forecast only"
            : paycheckState.lifecycle === "received"
              ? " · Confirm before allocations apply"
              : " · Allocations already applied"}
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
      {resolved.length > 0 ? (
        <IosCard padding="md">
          <p className="mb-3 text-[15px] font-semibold text-[var(--foreground)]">Planned allocation</p>
          <IosDonut
            segments={resolved.map((item) => ({ value: item.amount }))}
            centerValue={formatCurrency(plan.paycheckAmount)}
            centerLabel="Total"
          />
          <div className="mt-4 flex flex-col gap-2">
            {resolved.map((item) => {
              const share =
                plan.paycheckAmount > 0
                  ? Math.round((item.amount / plan.paycheckAmount) * 100)
                  : 0;
              return (
                <div key={item.allocation.id} className="flex items-center justify-between gap-3">
                  <p className="truncate text-[13px] text-[var(--text-secondary)]">
                    {item.allocation.name}
                    <span className="text-[var(--text-muted)]"> · {share}%</span>
                  </p>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </IosCard>
      ) : null}
      <IosPrimaryButton onClick={onToggleEditor}>
        {showEditor ? "Hide plan editor" : "Review plan"}
      </IosPrimaryButton>
      {(() => {
        const dates = [plan.nextPayDate];
        let cursor = plan;
        for (let index = 0; index < 2; index += 1) {
          const next = advancePayDate(cursor);
          if (!next || dates.includes(next)) break;
          dates.push(next);
          cursor = { ...plan, nextPayDate: next };
        }
        return (
          <IosSection title="Upcoming paychecks">
            <IosList>
              {dates.map((date) => (
                <IosListRow
                  key={date}
                  title={formatPayDate(date)}
                  subtitle={describePaySchedule(plan)}
                  leading={<IosAvatar fallback="$" tone="success" />}
                  trailing={formatCurrency(plan.paycheckAmount)}
                />
              ))}
            </IosList>
          </IosSection>
        );
      })()}
      {showOutlook ? (
        <IosCard padding="md">
          <p className="text-[13px] font-medium text-[var(--text-muted)]">Cash-flow outlook</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] text-[var(--text-muted)]">Confirmed cash</p>
              <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(outlook.availableCash)}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-[var(--text-muted)]">30-day low</p>
              <p
                className={`mt-0.5 text-[17px] font-semibold tabular-nums ${
                  outlook.lowBalance.amount < 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {formatCurrency(outlook.lowBalance.amount)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-snug text-[var(--text-secondary)]">
            {cashOutlook ?? "No dip below today’s confirmed cash in this window."}
          </p>
        </IosCard>
      ) : null}
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
    tabParam === "plan"
      ? "plan"
      : tabParam === "sources"
        ? "sources"
        : tabParam === "history" || tabParam === "forecast"
          ? "history"
          : "upcoming";
  const [tab, setTab] = useState<IncomeTab>(initialTab);
  const [details, setDetails] = useState<"history" | "forecast" | null>(
    tabParam === "forecast" ? "forecast" : "history",
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
    if (next === "upcoming") {
      params.delete("tab");
    } else if (next === "history") {
      params.set("tab", details === "forecast" ? "forecast" : "history");
    } else {
      params.set("tab", next);
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
          label={tab === "sources" ? "Monthly income" : "Income plan"}
          value={formatCurrency(
            tab === "sources"
              ? summary.monthlyIncome
              : summary.nextPaycheck?.amount ?? finance.incomePlan?.paycheckAmount ?? summary.monthlyIncome,
          )}
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

      <IosSegmentedControl
        variant="pills"
        value={tab}
        onChange={setIncomeTab}
        options={[
          { value: "upcoming", label: "Upcoming" },
          { value: "plan", label: "Plan" },
          { value: "sources", label: "Sources" },
          { value: "history", label: "History" },
        ]}
      />

      {tab === "upcoming" ? (
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

      {tab === "plan" ? (
        <div className="ios-embedded-panel [&_.page-header]:hidden [&_h1]:text-[17px] [&_h2]:text-[15px]">
          <IncomePlanContent embedded />
        </div>
      ) : null}

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

      {tab === "history" ? (
        <div className="flex flex-col gap-3">
          <div className="ios-embedded-panel">
            <IncomeLedgerPanel />
          </div>
          <IosTextButton
            onClick={() => {
              void triggerHaptic("selection");
              setDetails(details === "forecast" ? "history" : "forecast");
            }}
          >
            {details === "forecast" ? "Hide forecast" : "Income forecast"}
          </IosTextButton>
          {details === "forecast" ? (
            <div className="ios-embedded-panel">
              <IncomeForecastPanel />
            </div>
          ) : null}
        </div>
      ) : null}

      <IosBottomSheet
        open={selectedSource !== null}
        title={selectedSource?.name}
        onClose={() => setSelectedSource(null)}
        footer={
          selectedSource ? (
            <div className="flex gap-2">
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
                  void triggerHaptic("light");
                  const source = findIncome(selectedSource.id);
                  setSelectedSource(null);
                  if (source) setEditIncomeId(source.id);
                }}
              >
                Edit
              </button>
            </div>
          ) : null
        }
      >
        {selectedSource ? (
          <div>
            <p className="text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--success)]">
              {formatCurrency(selectedSource.amount)}
            </p>
            <p className="mt-2 text-center text-[13px] text-[var(--text-muted)]">
              {selectedSource.frequencyLabel} · {selectedSource.statusLabel}
            </p>
            <div className="mt-5 rounded-[16px] bg-white/[0.04] px-3.5">
              <IosDetailLine
                label="Next pay"
                value={selectedSource.nextPayDate || "not scheduled"}
              />
              <IosDetailLine
                label="Deposits to"
                value={selectedSource.depositAccountName || "unassigned"}
              />
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
