import { getAllocationProgress } from "@/lib/incomePlan/allocations";
import { isExtraPaycheckMonth } from "@/lib/incomePlan/payDates";
import type { AutomationSuggestion } from "@/lib/automation/types";
import { computeDashboard } from "@/lib/finance/computeDashboard";
import type { FinanceData } from "@/lib/finance/types";

function getWeekStart(referenceDate: Date): string {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function detectSmartSuggestions(
  data: FinanceData,
  referenceDate = new Date(),
): AutomationSuggestion[] {
  const suggestions: AutomationSuggestion[] = [];
  const dashboard = computeDashboard(data);
  const safeCash = dashboard.billsSummary.safeToSpendAfterUpcomingBills;

  const fundableGoal = data.savingsGoals
    .map((goal) => ({
      goal,
      remaining: Math.max(goal.target - goal.current, 0),
    }))
    .filter((item) => item.remaining > 0 && safeCash >= item.remaining)
    .sort((left, right) => right.remaining - left.remaining)[0];

  if (fundableGoal) {
    const { goal, remaining } = fundableGoal;

    suggestions.push({
      id: `automation-goal-fundable-${goal.id}`,
      kind: "goal_fundable",
      title: `You have enough cash to complete your ${goal.name} goal.`,
      description: `${goal.icon} ${goal.name} needs ${remaining.toFixed(2)} more and you have room after upcoming bills.`,
      icon: goal.icon,
      tone: "positive",
      priority: 70,
      timestamp: referenceDate.toISOString(),
      provider: "buxme",
      entityId: goal.id,
      entityType: "goal",
      detailHref: "/savings",
      primaryAction: {
        label: "View goal",
        type: "navigate",
        href: "/savings",
      },
      secondaryAction: {
        label: "Dismiss",
        type: "dismiss",
      },
    });
  }

  const plan = data.incomePlan;

  if (plan && isExtraPaycheckMonth(plan, referenceDate)) {
    suggestions.push({
      id: `automation-extra-paycheck-${referenceDate.toISOString().slice(0, 7)}`,
      kind: "extra_paycheck_month",
      title: "This month has a third paycheck.",
      description:
        "Consider debt payoff, your emergency fund, investing, or a vacation boost.",
      icon: "🎉",
      tone: "accent",
      priority: 65,
      timestamp: referenceDate.toISOString(),
      provider: "buxme",
      detailHref: "/income/plan",
      primaryAction: {
        label: "View Income Plan",
        type: "navigate",
        href: "/income/plan",
      },
      secondaryAction: {
        label: "Dismiss",
        type: "dismiss",
      },
    });
  }

  if (plan) {
    const weekStart = getWeekStart(referenceDate);
    const paychecksThisWeek = (data.incomePlanPaychecks ?? []).filter(
      (event) => event.payDate >= weekStart,
    );
    const progress = getAllocationProgress(
      plan,
      data.incomePlanPaychecks ?? [],
      referenceDate,
    );

    for (const allocation of plan.allocations) {
      if (allocation.isRemainingBalance) {
        continue;
      }

      const item = progress.find(
        (entry) => entry.allocationId === allocation.id,
      );
      const received = item?.receivedThisMonth ?? 0;
      const expected = allocation.amount ?? 0;

      if (expected <= 0 || received >= expected) {
        continue;
      }

      if (paychecksThisWeek.length === 0) {
        continue;
      }

      const fundedThisWeek = paychecksThisWeek.some((event) =>
        event.allocationEvents.some(
          (entry) =>
            entry.allocationId === allocation.id && entry.amount >= expected * 0.9,
        ),
      );

      if (fundedThisWeek) {
        continue;
      }

      suggestions.push({
        id: `automation-allocation-${allocation.id}-${weekStart}`,
        kind: "allocation_unfunded",
        title: `You haven't funded ${allocation.name} this week.`,
        description: `Your Income Plan sets aside ${expected.toFixed(2)} per paycheck for ${allocation.name}.`,
        icon: allocation.icon,
        tone: "neutral",
        priority: 60,
        timestamp: referenceDate.toISOString(),
        provider: "buxme",
        entityId: allocation.id,
        entityType: "allocation",
        detailHref: "/income/plan",
        primaryAction: {
          label: "View plan",
          type: "navigate",
          href: "/income/plan",
        },
        secondaryAction: {
          label: "Dismiss",
          type: "dismiss",
        },
      });
    }
  }

  const emergencyFund = data.savingsGoals.find(
    (goal) => goal.type === "emergency_fund",
  );

  if (
    emergencyFund &&
    emergencyFund.target > 0 &&
    emergencyFund.current / emergencyFund.target < 0.8
  ) {
    suggestions.push({
      id: `automation-emergency-fund-${emergencyFund.id}`,
      kind: "emergency_fund_low",
      title: "Your emergency fund is below your target.",
      description: `${emergencyFund.icon} ${emergencyFund.name} is at ${Math.round(
        (emergencyFund.current / emergencyFund.target) * 100,
      )}% of your goal.`,
      icon: emergencyFund.icon,
      tone: "negative",
      priority: 75,
      timestamp: referenceDate.toISOString(),
      provider: "buxme",
      entityId: emergencyFund.id,
      entityType: "goal",
      detailHref: "/savings",
      primaryAction: {
        label: "View goal",
        type: "navigate",
        href: "/savings",
      },
      secondaryAction: {
        label: "Dismiss",
        type: "dismiss",
      },
    });
  }

  return suggestions;
}
