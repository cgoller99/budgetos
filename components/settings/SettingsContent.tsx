"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { pageContainerClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { DEMO_PROFILES, getDemoProfile } from "@/lib/demo/profiles";
import type { DemoProfileId } from "@/lib/onboarding/types";

export function SettingsContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isConfigured, signOut } = useAuth();
  const {
    onboardingMode,
    demoProfileId,
    switchDemoProfile,
    isLoading,
  } = useFinance();
  const [switchingId, setSwitchingId] = useState<DemoProfileId | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSwitchProfile(profileId: DemoProfileId) {
    if (profileId === demoProfileId) {
      return;
    }

    setSwitchingId(profileId);

    try {
      await switchDemoProfile(profileId);
      showToast({
        title: "Demo profile updated",
        subtitle: `Now viewing ${getDemoProfile(profileId).name}`,
      });
      router.push("/dashboard");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
      showToast({ title: "Signed out", subtitle: "See you next time" });
      router.push("/login");
    } catch (error) {
      showToast({
        title: "Sign out failed",
        subtitle: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <div className={cn(pageContainerClassName)}>
      {isConfigured && (
        <Card padding="lg">
          <CardHeader title="Account" />
          <CardContent>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-base font-medium text-white">
                {user?.email ?? "Signed in"}
              </p>
              <Button
                variant="secondary"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card padding="lg">
        <CardHeader title="Experience" />
        <CardContent>
          <p className="text-base font-medium text-white">
            {onboardingMode === "demo"
              ? "Demo mode"
              : onboardingMode === "fresh"
                ? "Fresh start"
                : "Not configured"}
          </p>
          <p className="mt-2 text-base text-white/38">
            {onboardingMode === "demo" && demoProfileId
              ? `Exploring ${getDemoProfile(demoProfileId).name}'s finances`
              : onboardingMode === "fresh"
                ? "Building your own financial picture."
                : "Complete onboarding to get started."}
          </p>
        </CardContent>
      </Card>

      {onboardingMode === "demo" && (
        <Card padding="lg">
          <CardHeader title="Demo profiles" />
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {DEMO_PROFILES.map((profile) => {
                const isActive = profile.id === demoProfileId;
                const isSwitching = switchingId === profile.id;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={isActive || switchingId !== null}
                    onClick={() => void handleSwitchProfile(profile.id)}
                    className={cn(
                      "min-h-[4.5rem] rounded-2xl border px-5 py-4 text-left transition-all duration-200 ease-out",
                      isActive
                        ? "border-[#0077ed]/30 bg-[#0077ed]/10"
                        : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.07] hover:bg-white/[0.03]",
                      isSwitching && "opacity-70",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{profile.emoji}</span>
                      <div>
                        <p className="text-base font-medium text-white">
                          {profile.name}
                        </p>
                        <p className="mt-1 text-sm text-white/38">
                          {isActive
                            ? "Active"
                            : isSwitching
                              ? "Loading..."
                              : profile.tagline}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-sm leading-relaxed text-white/28">
        {isConfigured
          ? "Your finance data syncs to Supabase and is protected by Row Level Security."
          : "Demo data is stored locally on this device."}
      </p>
    </div>
  );
}
