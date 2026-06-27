import type { OnboardingMode, OnboardingState } from "@/lib/onboarding/types";

export function isDemoMode(
  mode: OnboardingMode | null | undefined,
): boolean {
  return mode === "demo";
}

export function createFreshOnboardingState(): OnboardingState {
  return {
    complete: true,
    mode: "fresh",
    demoProfileId: null,
  };
}

export function createDemoOnboardingState(
  demoProfileId: NonNullable<OnboardingState["demoProfileId"]>,
): OnboardingState {
  return {
    complete: true,
    mode: "demo",
    demoProfileId,
  };
}
