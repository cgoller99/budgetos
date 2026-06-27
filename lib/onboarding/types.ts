export type DemoProfileId =
  | "christian"
  | "young_professional"
  | "family"
  | "college_student";

export type OnboardingMode = "fresh" | "demo";

export type OnboardingState = {
  complete: boolean;
  mode: OnboardingMode | null;
  demoProfileId: DemoProfileId | null;
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  complete: false,
  mode: null,
  demoProfileId: null,
};
