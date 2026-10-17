"use client";

import Link from "next/link";
import { IosCard, IosScreen, IosSection } from "@/components/native/ios/IosPrimitives";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { formatCurrency } from "@/lib/finance/format";
import { useNativeIos } from "@/lib/native/useNativeIos";
import type { MoneyPlan } from "@/lib/plan/moneyPlan";

const NOTE =
  "This screen does not move money or change your Income Plan, bills, debts, goals, or budgets.";

function PlanSections({ plan }: { plan: MoneyPlan }) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">This month</h2>
        <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
          Safe to Spend is {formatCurrency(plan.safeToSpend)}. These rows are the current monthly cash-flow plan for {plan.month}.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {plan.stages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--text-muted)]">{stage.label}</span>
              <span className="font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(stage.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Income Plan</h2>
        {plan.incomePlan ? (
          <div className="mt-2 text-[13px] leading-snug text-[var(--text-muted)]">
            <p>
              {formatCurrency(plan.incomePlan.paycheckAmount)} · {plan.incomePlan.scheduleLabel}. Next date {plan.incomePlan.nextPayDate}.
            </p>
            {plan.incomePlan.allocations.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {plan.incomePlan.allocations.map((allocation) => (
                  <li key={allocation.id}>
                    {allocation.name}: {allocation.amountLabel}
                  </li>
                ))}
              </ul>
            ) : null}
            <Link href="/income" className="mt-2 inline-block font-semibold text-[var(--accent-light)]">
              Open Income Plan
            </Link>
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            No active Income Plan yet.{" "}
            <Link href="/income" className="font-semibold text-[var(--accent-light)]">
              Set one up
            </Link>
          </p>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Bills</h2>
        {plan.bills.length === 0 ? (
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">No unpaid bills in the current bill list.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--text-muted)]">
            {plan.bills.map((bill) => (
              <li key={bill.id}>
                {bill.name}: {formatCurrency(bill.amount)} due {bill.dueLabel}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Debt</h2>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Minimums total {formatCurrency(plan.debtMinimums)}.
        </p>
        {plan.debts.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--text-muted)]">
            {plan.debts.map((debt) => (
              <li key={debt.id}>
                {debt.name}: {formatCurrency(debt.minimumPayment)} · {debt.dueLabel}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Goals</h2>
        {plan.goals.length === 0 ? (
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">No open savings goals.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--text-muted)]">
            {plan.goals.map((goal) => (
              <li key={goal.id}>
                {goal.name}: {formatCurrency(goal.remaining)} left of {formatCurrency(goal.target)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Saved budgets</h2>
        {plan.budgets.length > 0 ? (
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Monthly budget total {formatCurrency(plan.monthlyBudgetTotal)}, on the same monthly basis as Safe to Spend ({formatCurrency(plan.safeToSpend)}).
          </p>
        ) : null}
        {plan.budgets.length === 0 ? (
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            No saved category limits yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-[13px] text-[var(--text-muted)]">
            {plan.budgets.map((budget) => (
              <li key={budget.category}>
                <span className={budget.over ? "font-semibold text-[var(--danger)]" : undefined}>
                  {budget.category}
                  {budget.over ? " is over the saved limit" : ` has ${formatCurrency(budget.remaining)} left`}
                </span>
                <span className="mt-0.5 block">{budget.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function MoneyPlanContent({ plan }: { plan: MoneyPlan }) {
  const nativeIos = useNativeIos();

  if (nativeIos) {
    return (
      <IosScreen>
        <IosSection title="Money Plan">
          <IosCard padding="md">
            <p className="text-[13px] leading-snug text-[var(--text-muted)]">{NOTE}</p>
            <div className="mt-4">
              <PlanSections plan={plan} />
            </div>
          </IosCard>
        </IosSection>
      </IosScreen>
    );
  }

  return (
    <div className={pageContainerWideClassName}>
      <Card>
        <CardHeader
          title="Money Plan"
          description="Income, bills, debt, goals, saved budgets, and the monthly cash-flow plan in one place."
        />
        <CardContent>
          <p className="mb-4 text-sm text-[var(--text-muted)]">{NOTE}</p>
          <PlanSections plan={plan} />
        </CardContent>
      </Card>
    </div>
  );
}
