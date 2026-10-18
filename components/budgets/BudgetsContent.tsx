"use client";

import { useMemo } from "react";
import { BudgetCategoryPanel, BudgetHealthSummary } from "@/components/budgets/BudgetCategoryPanel";
import { BudgetScheduleFields } from "@/components/budgets/BudgetScheduleFields";
import { CategoryBudgetStatus } from "@/components/budgets/CategoryBudgetStatus";
import {
  BudgetInsightsSection,
  PaycheckPlanDashboard,
} from "@/components/budgets/PaycheckPlanDashboard";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import { IosBudgetsScreen } from "@/components/native/ios/IosBudgetsScreen";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  SkeletonGrid,
} from "@/components/ui";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { buildBudgetHubSummary } from "@/lib/budgets/budgetHub";
import { budgetLimitLabel } from "@/lib/budgets/budgetPeriod";
import { getUpcomingBills } from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import { calculateMoneyLeftUntilPayday } from "@/lib/finance/moneyLeftUntilPayday";
import { useNativeIos } from "@/lib/native/useNativeIos";
import Link from "next/link";

export function BudgetsContent() {
  const finance = useFinance();
  const nativeIos = useNativeIos();
  const budgets = useCategoryBudgets();
  const hub = useMemo(
    () => buildBudgetHubSummary(budgets.views, finance),
    [budgets.views, finance],
  );
  const moneyLeft = useMemo(
    () => calculateMoneyLeftUntilPayday(finance),
    [finance],
  );
  const upcomingBills = useMemo(() => getUpcomingBills(finance).slice(0, 6), [finance]);
  const warningCount =
    hub.overspentCategories.length +
    (moneyLeft.moneyLeftAfterCommitments < 0 ? 1 : 0) +
    upcomingBills.filter((bill) => bill.remainingAmount > 0 && bill.status === "overdue")
      .length;

  if (nativeIos) {
    return <IosBudgetsScreen />;
  }

  if (finance.isLoading && budgets.status === "loading") {
    return <SkeletonGrid count={4} />;
  }

  return (
    <div className={cn(pageContainerWideClassName)}>
      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Budgets
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Ongoing paycheck plan first — then linked accounts, projections, spending, and
          suggestions last.
        </p>
      </div>

      <CategoryBudgetStatus
        status={budgets.status}
        message={budgets.syncMessage}
        onRetry={budgets.retry}
      />

      {/* 1–3: Ongoing Budget, Linked Accounts, Projected Balances */}
      <div className="mt-4">
        <PaycheckPlanDashboard />
      </div>

      {/* 4. Spending Progress and Upcoming Bills */}
      <Card className="mt-4">
        <CardHeader
          title="4. Spending Progress & Upcoming Bills"
          description="Category limits and bills — separate from paycheck parking and Safe to Spend cash."
        />
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label="Safe to Spend"
              value={formatCurrency(hub.safeToSpend)}
              hint="Cash-capped"
            />
            <Metric
              label="Until payday"
              value={formatCurrency(hub.safeUntilPayday)}
              hint={
                hub.daysUntilPayday != null
                  ? `${hub.daysUntilPayday}d left`
                  : "No payday"
              }
            />
            <Metric
              label="Budget remaining"
              value={formatCurrency(hub.totalRemainingBudgetAllowance)}
              hint="Limits — not cash"
            />
            <Metric
              label="After commitments"
              value={formatCurrency(moneyLeft.moneyLeftAfterCommitments)}
              hint="Until payday"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Upcoming bills
              </p>
              {upcomingBills.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No upcoming bills.</p>
              ) : (
                upcomingBills.map((bill) => (
                  <div
                    key={`${bill.billId}-${bill.dueDate?.toISOString() ?? bill.name}`}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-[var(--foreground)]">
                      {bill.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                      {formatCurrency(bill.remainingAmount)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2 text-sm">
              <Detail
                label="Planned savings until payday"
                value={formatCurrency(hub.plannedSavingsUntilPayday)}
              />
              <Detail
                label="Projected period surplus / shortfall"
                value={formatCurrency(hub.projectedPeriodSurplusOrShortfall)}
              />
              <p className="pt-1 text-xs text-[var(--text-muted)]">{hub.explanation}</p>
            </div>
          </div>

          {budgets.views.length > 0 ? (
            <div>
              <BudgetHealthSummary views={budgets.views} />
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Monthly-equivalent total {formatCurrency(budgets.monthlyBudgetTotal)}. Each
                category still uses its own period.
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Category budgets
            </h3>
            {budgets.views.length === 0 ? (
              <EmptyState
                icon="📊"
                title="No category budgets yet"
                description="Your Income Plan above is the paycheck source of truth. Add category limits when you want separate spending caps."
              />
            ) : (
              budgets.views.map((view) => (
                <BudgetCategoryPanel
                  key={view.category}
                  view={view}
                  onUpdateBudget={budgets.updateBudget}
                  onUpdateAmount={budgets.updateAmount}
                  onRemove={budgets.removeBudget}
                  onSetRollover={budgets.setRollover}
                />
              ))
            )}
          </div>

          <form
            onSubmit={budgets.addBudget}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
          >
            <p className="text-sm font-medium text-[var(--foreground)]">Add a category budget</p>
            <label className="block text-xs text-[var(--text-muted)]">
              Category
              <Input
                value={budgets.category}
                onChange={(event) => budgets.setCategory(event.target.value)}
                placeholder="Groceries"
                aria-label="Budget category"
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-[var(--text-muted)]">
              {budgetLimitLabel(budgets.frequency)}
              <Input
                value={budgets.amount}
                onChange={(event) => budgets.setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="150"
                aria-label="Budget amount"
                className="mt-1"
              />
            </label>
            <BudgetScheduleFields
              tone="web"
              idPrefix="new-budget"
              value={{
                frequency: budgets.frequency,
                anchorDate: budgets.anchorDate || null,
                weekday: budgets.weekday,
                monthDays: budgets.monthDays,
                intervalDays: budgets.intervalDays,
              }}
              onChange={budgets.applyDraftSchedule}
            />
            <Button type="submit" className="self-start min-h-11">
              Save budget
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 5. Suggestions & Insights — always last, collapsed */}
      <BudgetInsightsSection warningCount={warningCount}>
        {moneyLeft.moneyLeftAfterCommitments < 0 ? (
          <p className="mb-3 text-sm text-[var(--danger)]">
            Bill / commitment shortfall until payday:{" "}
            {formatCurrency(Math.abs(moneyLeft.moneyLeftAfterCommitments))} — review bills
            before increasing discretionary spending.
          </p>
        ) : null}
        {(hub.approachingLimits.length > 0 || hub.overspentCategories.length > 0) && (
          <div className="mb-3 space-y-2">
            <p className="text-sm font-medium text-[var(--foreground)]">Spending pace</p>
            {[...hub.overspentCategories, ...hub.approachingLimits].map((view) => (
              <p key={view.category} className="text-sm text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--foreground)]">{view.category}</span>
                {": "}
                {view.alert ?? "Watch"} · {formatCurrency(view.spent)} of{" "}
                {formatCurrency(view.effectiveLimit)} · {view.daysRemaining} days left
              </p>
            ))}
          </div>
        )}
        {budgets.suggestions.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {budgets.suggestions.map((suggestion) => (
              <li key={suggestion.category} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {suggestion.category}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatCurrency(suggestion.suggestedLimit)} / month · {suggestion.months}{" "}
                    months
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11"
                  onClick={() =>
                    budgets.acceptSuggestion(
                      suggestion.category,
                      suggestion.suggestedLimit,
                    )
                  }
                >
                  Use this limit
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            No suggested limits right now.{" "}
            <Link href="/income?tab=plan" className="text-[var(--accent-light)] hover:underline">
              Edit Income Plan
            </Link>
          </p>
        )}
      </BudgetInsightsSection>

      <MobileCollapsibleSection
        title="How cash stays separate"
        description="Notes"
        className="mt-6"
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
          <li>Safe to Spend stays cash-capped after bills and planned savings.</li>
          <li>Goal contributions are planned until a paycheck is confirmed.</li>
          <li>Contribution totals are planned additions — not guaranteed balances.</li>
          <li>Account links do not initiate bank transfers.</li>
        </ul>
      </MobileCollapsibleSection>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--surface-subtle)] px-3 py-2.5">
      <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
    </div>
  );
}
