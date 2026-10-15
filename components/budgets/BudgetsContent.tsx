"use client";

import { useMemo } from "react";
import { BudgetCategoryPanel, BudgetHealthSummary } from "@/components/budgets/BudgetCategoryPanel";
import { BudgetScheduleFields } from "@/components/budgets/BudgetScheduleFields";
import { CategoryBudgetStatus } from "@/components/budgets/CategoryBudgetStatus";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  SkeletonGrid,
  StatCard,
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
import { buildUnifiedFinancialPlan } from "@/lib/finance/unifiedFinancialPlan";
import Link from "next/link";

export function BudgetsContent() {
  const finance = useFinance();
  const budgets = useCategoryBudgets();
  const hub = useMemo(
    () => buildBudgetHubSummary(budgets.views, finance),
    [budgets.views, finance],
  );
  const moneyLeft = useMemo(
    () => calculateMoneyLeftUntilPayday(finance),
    [finance],
  );
  const unified = useMemo(() => buildUnifiedFinancialPlan(finance), [finance]);
  const paycheck = unified.paycheck;
  const upcomingBills = useMemo(() => getUpcomingBills(finance).slice(0, 4), [finance]);

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
          Flexible category limits on your schedule — separate from Safe to Spend cash.
        </p>
      </div>

      <CategoryBudgetStatus
        status={budgets.status}
        message={budgets.syncMessage}
        onRetry={budgets.retry}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Safe to Spend"
          value={formatCurrency(hub.safeToSpend)}
          change="Cash-capped after bills & planned savings"
          mutedChange
        />
        <StatCard
          label="Until payday"
          value={formatCurrency(hub.safeUntilPayday)}
          change={
            hub.daysUntilPayday != null
              ? `${hub.daysUntilPayday} day${hub.daysUntilPayday === 1 ? "" : "s"} left`
              : "No payday scheduled"
          }
          mutedChange
        />
        <StatCard
          label="Daily allowance"
          value={formatCurrency(hub.dailySpendingAllowance)}
          change="From cash until payday"
          mutedChange
        />
        <StatCard
          label="Budget remaining"
          value={formatCurrency(hub.totalRemainingBudgetAllowance)}
          change="Unused category limits — not cash"
          mutedChange
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Why these numbers differ"
          description={hub.explanation}
        />
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Detail
            label="Planned savings until payday"
            value={formatCurrency(hub.plannedSavingsUntilPayday)}
          />
          <Detail
            label="Money left after commitments"
            value={formatCurrency(moneyLeft.moneyLeftAfterCommitments)}
          />
          <Detail
            label="Projected period surplus / shortfall"
            value={formatCurrency(hub.projectedPeriodSurplusOrShortfall)}
          />
        </CardContent>
      </Card>

      {(hub.approachingLimits.length > 0 || hub.overspentCategories.length > 0) && (
        <Card className="mt-4">
          <CardHeader title="Spending pace" description="Categories that need attention." />
          <CardContent className="space-y-2">
            {[...hub.overspentCategories, ...hub.approachingLimits].map((view) => (
              <p key={view.category} className="text-sm text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--foreground)]">{view.category}</span>
                {": "}
                {view.alert ?? "Watch"} · {formatCurrency(view.spent)} of{" "}
                {formatCurrency(view.effectiveLimit)} · {view.daysRemaining} days left
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming bills" description="Due soon — already reflected in cash until payday." />
          <CardContent className="space-y-2">
            {upcomingBills.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No upcoming bills.</p>
            ) : (
              upcomingBills.map((bill) => (
                <div
                  key={`${bill.billId}-${bill.dueDate?.toISOString() ?? bill.name}`}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--foreground)]">{bill.name}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">
                    {formatCurrency(bill.remainingAmount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Paycheck commitments"
            description="Planned Income Plan rows by stable IDs — not cash yet."
          />
          <CardContent className="space-y-2 text-sm">
            {paycheck ? (
              <>
                <Detail
                  label="Expected paycheck"
                  value={formatCurrency(paycheck.expectedPaycheck)}
                />
                <Detail
                  label="Bills allocated"
                  value={formatCurrency(paycheck.billsAllocated)}
                />
                <Detail
                  label="Goal allocations"
                  value={formatCurrency(paycheck.savingsGoalAllocations)}
                />
                <Detail
                  label="Extra debt"
                  value={formatCurrency(paycheck.extraDebtPayments)}
                />
                <Detail
                  label="Flexible spending"
                  value={formatCurrency(paycheck.flexibleSpendingAllocations)}
                />
                <Detail
                  label="Unallocated"
                  value={formatCurrency(paycheck.remainingUnallocated)}
                />
                {unified.goals.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-[var(--surface-border)] pt-2">
                    {unified.goals.map((goal) => (
                      <li key={goal.goalId} className="flex justify-between gap-2 text-xs">
                        <Link
                          href={`/savings`}
                          className="text-[var(--accent-light)] hover:underline"
                        >
                          {goal.name}
                        </Link>
                        <span className="tabular-nums text-[var(--text-muted)]">
                          {formatCurrency(goal.perPaycheck)} / paycheck
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="pt-1 text-xs text-[var(--text-muted)]">
                  <Link href="/income?tab=plan" className="text-[var(--accent-light)] hover:underline">
                    Edit Income Plan
                  </Link>
                </p>
              </>
            ) : (
              <p className="text-[var(--text-muted)]">
                Set up an Income Plan to see paycheck allocations here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {budgets.views.length > 0 ? (
        <div className="mt-6">
          <BudgetHealthSummary views={budgets.views} />
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Monthly-equivalent total {formatCurrency(budgets.monthlyBudgetTotal)} for Safe to
            Spend context. Each category still uses its own period.
          </p>
        </div>
      ) : null}

      {budgets.suggestions.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title="Suggested limits"
            description="From recent spending. Nothing is active until you confirm."
          />
          <CardContent>
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
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 space-y-4">
        {budgets.views.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No category budgets yet"
            description="Add weekly, biweekly, twice-monthly, monthly, or custom limits per category."
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

      <Card className="mt-6">
        <CardHeader title="Add a budget" description="Each category keeps its own reset schedule." />
        <CardContent>
          <form onSubmit={budgets.addBudget} className="flex flex-col gap-3">
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
            <Button type="submit" className="self-start">
              Save budget
            </Button>
          </form>
        </CardContent>
      </Card>

      <MobileCollapsibleSection
        title="Budget history notes"
        description="How periods and cash stay separate"
        className="mt-6"
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
          <li>Weekly, biweekly, twice monthly, monthly, and custom periods use real date boundaries.</li>
          <li>Rollover only increases category allowance — it never invents spendable cash.</li>
          <li>Goal contributions are planned commitments, not ordinary category spending.</li>
          <li>Safe to Spend stays cash-capped after bills and planned savings.</li>
        </ul>
      </MobileCollapsibleSection>
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
