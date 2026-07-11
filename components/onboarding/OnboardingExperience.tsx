"use client";

import { Suspense } from "react";
import { GuidedOnboardingExperience } from "@/components/onboarding/GuidedOnboardingExperience";
import { PageLoadingState } from "@/components/ui";

export function OnboardingExperience() {
  return (
    <Suspense fallback={<PageLoadingState label="Loading onboarding" />}>
      <GuidedOnboardingExperience />
    </Suspense>
  );
}
