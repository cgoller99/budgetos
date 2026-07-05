import type { FinanceData } from "@/lib/finance/types";
import { parseDateString, startOfDay, toDateString } from "@/lib/recurring/schedule";
import type { AutomationSuggestion } from "@/lib/automation/types";

const AUTO_RUN_STORAGE_KEY = "buxme-last-auto-paycheck";

function readLastAutoRun(planId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTO_RUN_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[planId] ?? null;
  } catch {
    return null;
  }
}

function writeLastAutoRun(planId: string, payDate: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(AUTO_RUN_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[planId] = payDate;
    window.localStorage.setItem(AUTO_RUN_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage failures
  }
}

export function isIncomePlanPaycheckDue(
  data: FinanceData,
  referenceDate = new Date(),
): boolean {
  const plan = data.incomePlan;
  if (!plan?.nextPayDate || plan.paycheckAmount <= 0) {
    return false;
  }

  const today = startOfDay(referenceDate);
  const dueDate = startOfDay(parseDateString(plan.nextPayDate));

  if (dueDate.getTime() > today.getTime()) {
    return false;
  }

  const lastRun = readLastAutoRun(plan.id);
  return lastRun !== plan.nextPayDate;
}

export function markIncomePlanAutoRun(planId: string, payDate: string): void {
  writeLastAutoRun(planId, payDate);
}

export function shouldAutoApplyPlaidPaycheck(
  suggestions: AutomationSuggestion[],
): AutomationSuggestion | null {
  return (
    suggestions.find(
      (suggestion) => suggestion.primaryAction.type === "apply_paycheck",
    ) ?? null
  );
}

export function describeAutoRunReason(data: FinanceData): string {
  const plan = data.incomePlan;
  if (!plan?.nextPayDate) {
    return "Income plan scheduled";
  }

  return `Paycheck due ${toDateString(parseDateString(plan.nextPayDate))}`;
}
