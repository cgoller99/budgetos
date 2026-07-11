import type { IncomePlanSchedule } from "@/lib/incomePlan/types";

export type OnboardingSetupPath = "plaid" | "manual";

export type OnboardingProgress = {
  setupPath?: OnboardingSetupPath;
  skippedManualAccounts?: boolean;
  showPlaidConnectBanner?: boolean;
  paySchedule?: IncomePlanSchedule;
  paycheckAmount?: number;
  accountName?: string;
  accountType?: string;
  accountBalance?: number;
  billName?: string;
  billAmount?: number;
  billDueDay?: number;
  goalName?: string;
  goalTarget?: number;
  inviteEmail?: string;
};

export const PLAID_ONBOARDING_TOTAL_STEPS = 4;
export const MANUAL_ONBOARDING_TOTAL_STEPS = 10;

export function getOnboardingTotalSteps(progress: OnboardingProgress): number {
  if (progress.setupPath === "plaid") {
    return PLAID_ONBOARDING_TOTAL_STEPS;
  }

  return MANUAL_ONBOARDING_TOTAL_STEPS;
}

export function shouldShowPlaidConnectBanner(input: {
  dismissed: boolean;
  hasPlaidConnection: boolean;
  progress: OnboardingProgress;
  accountCount: number;
}): boolean {
  if (input.dismissed || input.hasPlaidConnection) {
    return false;
  }

  return (
    input.progress.showPlaidConnectBanner === true ||
    input.progress.setupPath === "plaid" ||
    input.progress.skippedManualAccounts === true ||
    input.accountCount === 0
  );
}

import type { Account } from "@/lib/finance/types";

export function getManualAccounts(accounts: Account[]): Account[] {
  return accounts.filter((account) => !account.bankConnectionId);
}
