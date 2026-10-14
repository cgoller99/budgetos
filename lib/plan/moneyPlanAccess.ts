import { storedScheduleFields } from "@/lib/budgets/budgetPeriod";

export type MoneyPlanAccess = "full" | "preview";

export function resolveMoneyPlanAccess(input: {
  isFounder: boolean;
  hasProPlusAccess: boolean;
}): MoneyPlanAccess {
  if (input.isFounder || input.hasProPlusAccess) {
    return "full";
  }
  return "preview";
}

export type MoneyPlanPreviewBody = {
  access: "preview";
  upgradePlan: "pro_plus";
};

export type MoneyPlanFullBody<T> = {
  access: "full";
  plan: T;
};

export function moneyPlanApiResult<T>(input: {
  access: MoneyPlanAccess;
  plan: T | null;
}): {
  status: 200 | 403;
  body: MoneyPlanFullBody<T> | MoneyPlanPreviewBody;
} {
  if (input.access !== "full" || input.plan == null) {
    return {
      status: 403,
      body: {
        access: "preview",
        upgradePlan: "pro_plus",
      },
    };
  }

  return {
    status: 200,
    body: {
      access: "full",
      plan: input.plan,
    },
  };
}

export function sanitizeMoneyPlanBudgets(
  value: unknown,
): Array<{
  category: string;
  amount: number;
  frequency?: "weekly" | "biweekly" | "twice_monthly" | "monthly" | "custom";
  anchorDate?: string | null;
  weekday?: number | null;
  monthDays?: [number, number] | null;
  intervalDays?: number | null;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  const budgets: Array<{ category: string; amount: number }> = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as { category?: unknown; amount?: unknown };
    if (typeof record.category !== "string") {
      continue;
    }
    const category = record.category.trim();
    const amount =
      typeof record.amount === "number" ? record.amount : Number.NaN;
    if (
      !category ||
      category.length > 80 ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1_000_000
    ) {
      continue;
    }
    budgets.push({
      category,
      amount: Math.round(amount * 100) / 100,
      ...storedScheduleFields(item),
    });
    if (budgets.length >= 40) {
      break;
    }
  }
  return budgets;
}
