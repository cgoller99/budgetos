import type { FinanceData } from "@/lib/finance/types";
import type { OnboardingMode } from "@/lib/onboarding/types";
import { isDemoMode as isDemoModeFlag } from "@/lib/onboarding/demoMode";

const DEMO_ENTITY_ID_PREFIX = "demo-";

export function hasDemoFinanceData(data: FinanceData): boolean {
  const entityIds = [
    ...data.accounts.map((item) => item.id),
    ...data.bills.map((item) => item.id),
    ...data.debts.map((item) => item.id),
    ...data.investments.map((item) => item.id),
    ...data.income.map((item) => item.id),
    ...data.savingsGoals.map((item) => item.id),
    ...data.transactions.map((item) => item.id),
  ];

  return entityIds.some((id) => id.startsWith(DEMO_ENTITY_ID_PREFIX));
}

export function isUserInDemoMode(
  mode: OnboardingMode | null | undefined,
  data: FinanceData,
): boolean {
  return isDemoModeFlag(mode) || hasDemoFinanceData(data);
}
