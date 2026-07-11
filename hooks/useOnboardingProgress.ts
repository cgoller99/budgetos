"use client";

import { useEffect, useState } from "react";
import type { OnboardingProgress } from "@/lib/onboarding/progress";

export function useOnboardingProgress() {
  const [progress, setProgress] = useState<OnboardingProgress>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/onboarding/progress");
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { progress?: OnboardingProgress };
        if (!cancelled && payload.progress) {
          setProgress(payload.progress);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { progress, loaded };
}
