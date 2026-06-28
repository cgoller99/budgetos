"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { DEMO_PROFILES } from "@/lib/demo/profiles";
import type { DemoProfileId } from "@/lib/onboarding/types";

type OnboardingStep = "welcome" | "demo";

export function OnboardingExperience() {
  const router = useRouter();
  const { completeOnboarding } = useFinance();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [selectedProfile, setSelectedProfile] = useState<DemoProfileId | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleStartFresh() {
    setIsSubmitting(true);

    try {
      await completeOnboarding("fresh");
      router.push("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSelectDemo(profileId: DemoProfileId) {
    setSelectedProfile(profileId);
    setIsSubmitting(true);

    try {
      await completeOnboarding("demo", profileId);
      router.push("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0f1a] px-5 py-12 font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,119,237,0.18),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(99,102,241,0.08),transparent)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        {step === "welcome" ? (
          <div className="onboarding-step-enter text-center">
            <div className="onboarding-logo-enter mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-2xl backdrop-blur-sm">
              💰
            </div>

            <h1 className="onboarding-title-enter text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Welcome to Buxme
            </h1>
            <p className="onboarding-subtitle-enter mx-auto mt-4 max-w-md text-base text-white/50 sm:text-lg">
              Let&apos;s get your financial life organized.
            </p>

            <div className="onboarding-options-enter mt-12 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleStartFresh()}
                className="group onboarding-option-card rounded-2xl border border-white/[0.08] bg-[#111827]/60 p-6 text-left backdrop-blur-sm transition-all duration-300 ease-out hover:border-[#0077ed]/40 hover:bg-[#111827]/80 disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0077ed]/15 text-xl transition-transform duration-300 group-hover:scale-105">
                  ✨
                </span>
                <h2 className="mt-5 text-lg font-semibold text-white">
                  Start Fresh
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/45">
                  Begin with a clean slate and add your accounts, bills, and
                  goals as you go.
                </p>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setStep("demo")}
                className="group onboarding-option-card onboarding-option-card-delay rounded-2xl border border-white/[0.08] bg-[#111827]/60 p-6 text-left backdrop-blur-sm transition-all duration-300 ease-out hover:border-[#6366f1]/40 hover:bg-[#111827]/80 disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6366f1]/15 text-xl transition-transform duration-300 group-hover:scale-105">
                  🎭
                </span>
                <h2 className="mt-5 text-lg font-semibold text-white">
                  Explore a Demo
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/45">
                  Try Buxme with realistic profiles — perfect for exploring
                  every feature.
                </p>
              </button>
            </div>
          </div>
        ) : (
          <div className="onboarding-step-enter">
            <button
              type="button"
              onClick={() => setStep("welcome")}
              className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white/70"
            >
              <span aria-hidden>←</span>
              Back
            </button>

            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Choose a demo profile
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm text-white/45 sm:text-base">
                Each profile includes realistic accounts, bills, goals, and
                investments — ready to explore.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {DEMO_PROFILES.map((profile, index) => (
                <Card
                  key={profile.id}
                  hover
                  padding="none"
                  className={cn(
                    "onboarding-profile-card cursor-pointer overflow-hidden transition-all duration-300",
                    selectedProfile === profile.id &&
                      isSubmitting &&
                      "border-[#0077ed]/50 ring-1 ring-[#0077ed]/30",
                  )}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleSelectDemo(profile.id)}
                    className="w-full p-5 text-left disabled:cursor-wait"
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                        style={{ backgroundColor: `${profile.accent}20` }}
                      >
                        {profile.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-white">
                          {profile.name}
                        </h2>
                        <p className="mt-0.5 text-sm text-white/45">
                          {profile.tagline}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
                      {profile.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="flex items-center gap-2 text-xs text-white/55"
                        >
                          <span
                            className="h-1 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: profile.accent }}
                          />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </button>
                </Card>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("welcome")}
                disabled={isSubmitting}
              >
                Choose a different path
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
