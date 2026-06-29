"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HouseholdSection } from "@/components/household/HouseholdSection";
import { Button, Card, CardContent, CardHeader, FormField, Input } from "@/components/ui";
import { pageContainerClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { DEMO_PROFILES, getDemoProfile } from "@/lib/demo/profiles";
import { formatBuildLabel, getBuildInfo } from "@/lib/buildInfo";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  setNotificationPreferences,
  type NotificationCategory,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";
import type { DemoProfileId } from "@/lib/onboarding/types";
import { getSupabaseClient, getSupabaseConfig } from "@/lib/supabase";
import { ProfilesRepository } from "@/lib/supabase/repositories/profilesRepository";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemePreference,
} from "@/lib/theme/preferences";

const NOTIFICATION_LABELS: Record<
  NotificationCategory,
  { title: string; description: string }
> = {
  bills: {
    title: "Bills & payments",
    description: "Due dates, payment confirmations, and reminders.",
  },
  goals: {
    title: "Goals & milestones",
    description: "Progress updates and completed savings goals.",
  },
  household: {
    title: "Household",
    description: "Invite accepted and member activity.",
  },
  weeklySummary: {
    title: "Weekly summary",
    description: "Your weekly financial plan and recommendations.",
  },
};

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
}> = [
  {
    value: "dark",
    label: "Dark",
    description: "Low-glow look for focused planning.",
  },
  {
    value: "light",
    label: "Light",
    description: "Brighter surfaces for daytime use.",
  },
  {
    value: "system",
    label: "System",
    description: "Follow this device automatically.",
  },
];

function getInitials(fullName: string | null, email: string | null): string {
  const source = fullName?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatSessionDate(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return "Unknown";
  }

  const date =
    typeof value === "number" ? new Date(value * 1000) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PreferenceToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-all duration-200 ease-out",
        checked
          ? "border-[#0077ed]/40 bg-[#0077ed]/30"
          : "border-white/[0.08] bg-white/[0.04]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200 ease-out",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SettingsContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, session, isConfigured, signOut } = useAuth();
  const {
    isDemoMode,
    onboardingMode,
    demoProfileId,
    switchDemoProfile,
    exitDemoMode,
    isLoading,
    isSyncing,
  } = useFinance();
  const [switchingId, setSwitchingId] = useState<DemoProfileId | null>(null);
  const [isExitingDemo, setIsExitingDemo] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [fullName, setFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const buildInfo = getBuildInfo();
  const buildLabel = formatBuildLabel(buildInfo);

  const profileRepository = useMemo(() => {
    if (!isConfigured || !getSupabaseConfig().url) {
      return null;
    }

    return new ProfilesRepository(getSupabaseClient());
  }, [isConfigured]);

  useEffect(() => {
    setTheme(getStoredThemePreference());
    setNotificationPrefs(getNotificationPreferences());
  }, []);

  useEffect(() => {
    if (!profileRepository || !user) {
      return;
    }

    void profileRepository
      .loadProfile(user.id)
      .then((profile) => {
        setFullName(profile.fullName ?? "");
        setProfileEmail(profile.email ?? user.email ?? null);
      })
      .catch(() => {
        setProfileEmail(user.email ?? null);
      });
  }, [profileRepository, user]);

  const initials = getInitials(fullName, profileEmail ?? user?.email ?? null);

  async function handleSaveProfile() {
    if (!profileRepository || !user) {
      return;
    }

    setIsSavingProfile(true);

    try {
      const saved = await profileRepository.updateFullName(user.id, fullName);
      setFullName(saved);
      showToast({
        title: "Profile updated",
        subtitle: "Your display name has been saved.",
      });
    } catch (error) {
      showToast({
        title: "Unable to save profile",
        subtitle: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleThemeChange(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    setStoredThemePreference(nextTheme);
  }

  function handleNotificationPrefChange(
    category: NotificationCategory,
    enabled: boolean,
  ) {
    const next = { ...notificationPrefs, [category]: enabled };
    setNotificationPrefs(next);
    setNotificationPreferences(next);
  }

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

  async function handleExitDemoMode() {
    const confirmed = window.confirm(
      "Exit demo mode? Sample accounts, bills, and goals will be removed. You'll start with your own empty Buxme workspace.",
    );

    if (!confirmed) {
      return;
    }

    setIsExitingDemo(true);

    try {
      await exitDemoMode();
      showToast({
        title: "Demo mode exited",
        subtitle: "You're now viewing your own Buxme data.",
      });
      router.push("/dashboard");
    } finally {
      setIsExitingDemo(false);
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
          <CardHeader title="Profile" />
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0077ed]/10 text-lg font-semibold text-[#4da3ff]"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-white">
                  {fullName.trim() || "Your profile"}
                </p>
                <p className="mt-1 text-sm text-white/40">
                  {profileEmail ?? user?.email ?? "Signed in"}
                </p>
              </div>
            </div>
            <FormField label="Display name">
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
              />
            </FormField>
            <Button
              variant="secondary"
              onClick={() => void handleSaveProfile()}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? "Saving..." : "Save profile"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card padding="lg">
        <CardHeader
          title="Theme"
          description="Choose the look that feels best right now. Dark remains the default for new sessions."
        />
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemeChange(option.value)}
                className={cn(
                  "rounded-2xl border px-5 py-4 text-left transition-all duration-200 ease-out",
                  theme === option.value
                    ? "border-[#0077ed]/30 bg-[#0077ed]/10 text-[var(--foreground)]"
                    : "border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] hover:border-[var(--surface-border-strong)] hover:text-[var(--foreground)]",
                )}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-subtle)]">
            Your choice is saved on this device and applied before the page appears.
          </p>
        </CardContent>
      </Card>

      <Card padding="lg">
        <CardHeader title="Notifications" />
        <CardContent className="space-y-4">
          {(Object.keys(NOTIFICATION_LABELS) as NotificationCategory[]).map(
            (category) => {
              const meta = NOTIFICATION_LABELS[category];

              return (
                <div
                  key={category}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{meta.title}</p>
                    <p className="mt-1 text-xs text-white/38">{meta.description}</p>
                  </div>
                  <PreferenceToggle
                    label={meta.title}
                    checked={notificationPrefs[category]}
                    onChange={(enabled) =>
                      handleNotificationPrefChange(category, enabled)
                    }
                  />
                </div>
              );
            },
          )}
          <p className="text-xs text-white/32">
            Preferences are stored in localStorage for now.
          </p>
        </CardContent>
      </Card>

      {isConfigured && (
        <Card padding="lg">
          <CardHeader title="Security" />
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-white/70">Email</p>
              <p className="mt-1 text-base text-white">
                {profileEmail ?? user?.email ?? "—"}
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="inline-flex text-sm text-[#4da3ff] transition-colors hover:text-[#0077ed]"
            >
              Reset password via email
            </Link>
          </CardContent>
        </Card>
      )}

      {isConfigured && (
        <Card padding="lg">
          <CardHeader title="Session" />
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-white/70">Signed in as</p>
                <p className="mt-1 text-base text-white">
                  {profileEmail ?? user?.email ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-white/70">Last sign in</p>
                <p className="mt-1 text-base text-white">
                  {formatSessionDate(user?.last_sign_in_at)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-white/70">Session expires</p>
                <p className="mt-1 text-base text-white">
                  {formatSessionDate(session?.expires_at)}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isConfigured && <HouseholdSection />}

      <Card padding="lg">
        <CardHeader title="Experience" />
        <CardContent className="space-y-4">
          <div>
            <p className="text-base font-medium text-white">
              {isDemoMode
                ? "Demo mode"
                : onboardingMode === "fresh"
                  ? "Your workspace"
                  : "Not configured"}
            </p>
            <p className="mt-2 text-base text-white/38">
              {isDemoMode && demoProfileId
                ? `Exploring ${getDemoProfile(demoProfileId).name}'s sample finances.`
                : onboardingMode === "fresh"
                  ? "Using your own Buxme data. Add accounts, bills, and goals to get started."
                  : "Complete onboarding to get started."}
            </p>
          </div>

          {isDemoMode && (
            <Button
              onClick={() => void handleExitDemoMode()}
              disabled={isSyncing || isExitingDemo}
            >
              {isExitingDemo ? "Exiting demo mode..." : "Exit Demo Mode"}
            </Button>
          )}
        </CardContent>
      </Card>

      {isDemoMode && (
        <Card padding="lg">
          <CardHeader title="Demo profiles" />
          <CardContent>
            <p className="mb-4 text-sm text-white/45">
              Switch between sample profiles without leaving demo mode.
            </p>
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
          ? isDemoMode
            ? "Demo data is stored in your Supabase account until you exit demo mode."
            : "Your finance data syncs to Supabase and is protected by Row Level Security."
          : "Connect Supabase to sync your finance data across devices."}
      </p>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-200/70">
          Build (temporary)
        </p>
        <p className="mt-1 font-mono text-sm text-amber-100/90">{buildLabel}</p>
        <p className="mt-1 font-mono text-xs text-amber-100/50">
          {buildInfo.commit} · {buildInfo.builtAt}
        </p>
      </div>
    </div>
  );
}
