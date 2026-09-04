"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IosAvatar,
  IosCard,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTintIcon,
} from "@/components/native/ios/IosPrimitives";
import { HouseholdSection } from "@/components/household/HouseholdSection";
import { ConnectedInstitutionsSection } from "@/components/settings/ConnectedInstitutionsSection";
import { AccountDeletionSection } from "@/components/settings/AccountDeletionSection";
import { BillingSection } from "@/components/settings/BillingSection";
import { Button, FormField, Input, PreferenceToggle } from "@/components/ui";
import { NavIcon } from "@/components/NavIcon";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  setNotificationPreferences,
  syncNotificationPreferencesFromServer,
  type NotificationCategory,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";
import { getSupabaseClient, getSupabaseConfig } from "@/lib/supabase";
import { ProfilesRepository } from "@/lib/supabase/repositories/profilesRepository";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemePreference,
} from "@/lib/theme/preferences";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

type SettingsPanel =
  | "profile"
  | "billing"
  | "connections"
  | "household"
  | "notifications"
  | "theme"
  | "security"
  | "delete-account"
  | null;

const NOTIFICATION_LABELS: Record<NotificationCategory, string> = {
  bills: "Bills & payments",
  goals: "Goals & milestones",
  household: "Household",
  weeklySummary: "Weekly summary",
};

function panelFromHash(): SettingsPanel {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace("#", "");
  if (hash === "billing") return "billing";
  if (hash === "connections") return "connections";
  if (hash === "household") return "household";
  if (hash === "delete-account" || hash === "account") return "delete-account";
  return null;
}

export function IosSettingsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isConfigured, signOut } = useAuth();
  const { isLoading, isDemoMode, exitDemoMode, isSyncing } = useFinance();
  const [panel, setPanel] = useState<SettingsPanel>(null);
  const [fullName, setFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );

  const profileRepository = useMemo(() => {
    if (!isConfigured || !getSupabaseConfig().url) return null;
    return new ProfilesRepository(getSupabaseClient());
  }, [isConfigured]);

  useEffect(() => {
    setPanel(panelFromHash());
    function onHash() {
      setPanel(panelFromHash());
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setTheme(getStoredThemePreference());
    setNotificationPrefs(getNotificationPreferences());
  }, []);

  useEffect(() => {
    if (!profileRepository || !user) return;
    void profileRepository
      .loadProfile(user.id)
      .then((profile) => {
        setFullName(profile.fullName ?? "");
        setProfileEmail(profile.email ?? user.email ?? null);
      })
      .catch(() => setProfileEmail(user.email ?? null));
    void profileRepository
      .loadNotificationPreferences(user.id)
      .then((prefs) => {
        setNotificationPrefs(prefs);
        syncNotificationPreferencesFromServer(prefs);
      })
      .catch(() => setNotificationPrefs(getNotificationPreferences()));
  }, [profileRepository, user]);

  if (isLoading) {
    return <IosSkeletonScreen rows={6} />;
  }

  function openPanel(next: SettingsPanel, hash?: string) {
    void triggerHaptic("selection");
    setPanel((current) => (current === next ? null : next));
    if (hash) {
      window.history.replaceState(null, "", `/settings#${hash}`);
    } else if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings");
    }
  }

  async function handleSaveProfile() {
    if (!profileRepository || !user) return;
    setIsSavingProfile(true);
    try {
      const saved = await profileRepository.updateFullName(user.id, fullName);
      setFullName(saved);
      void triggerHaptic("success");
      showToast({ title: "Profile updated", type: "success" });
    } catch (error) {
      showToast({
        title: "Unable to save profile",
        subtitle: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <IosScreen>
      <div className="flex items-center gap-3 px-0.5">
        <IosAvatar
          fallback={(fullName || profileEmail || "ME").slice(0, 2).toUpperCase()}
          tone="accent"
        />
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-[var(--foreground)]">
            {fullName.trim() || "Your profile"}
          </p>
          <p className="truncate text-[13px] text-[var(--text-muted)]">
            {profileEmail ?? user?.email ?? "Signed in"}
          </p>
        </div>
      </div>

      <IosSection title="Account">
        <IosList>
          <IosListRow
            title="Profile"
            subtitle="Display name"
            leading={
              <IosTintIcon tone="accent">
                <NavIcon name="settings" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("profile")}
          />
          <IosListRow
            title="Subscription"
            subtitle="Billing & plan"
            leading={
              <IosTintIcon tone="warning">
                <NavIcon name="reports" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("billing", "billing")}
          />
          <IosListRow
            title="Bank connections"
            subtitle="Plaid institutions"
            leading={
              <IosTintIcon tone="success">
                <NavIcon name="accounts" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("connections", "connections")}
          />
          <IosListRow
            title="Household"
            subtitle="Shared access"
            leading={
              <IosTintIcon tone="purple">
                <NavIcon name="settings" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("household", "household")}
          />
          <IosListRow
            title="Delete Account"
            subtitle="Permanent"
            danger
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("delete-account", "delete-account")}
          />
        </IosList>
      </IosSection>

      <IosSection title="Preferences">
        <IosList>
          <IosListRow
            title="Notifications"
            leading={
              <IosTintIcon tone="accent">
                <NavIcon name="bills" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("notifications")}
          />
          <IosListRow
            title="Theme"
            subtitle={theme}
            leading={
              <IosTintIcon tone="muted">
                <NavIcon name="reports" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("theme")}
          />
          <IosListRow
            title="Security"
            subtitle="Password & session"
            leading={
              <IosTintIcon tone="danger">
                <NavIcon name="settings" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => openPanel("security")}
          />
        </IosList>
      </IosSection>

      <IosSection title="App">
        <IosList>
          <IosListRow
            title="What's New"
            href="/whats-new"
            leading={
              <IosTintIcon tone="accent">
                <NavIcon name="reports" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
          />
          <IosListRow
            title="Roadmap"
            href="/roadmap"
            leading={
              <IosTintIcon tone="warning">
                <NavIcon name="roadmap" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
          />
          <IosListRow
            title="Support"
            leading={
              <IosTintIcon tone="success">
                <NavIcon name="settings" className="h-4 w-4" />
              </IosTintIcon>
            }
            trailing={<span className="text-[var(--text-subtle)]">›</span>}
            onClick={() => {
              void triggerHaptic("light");
              window.dispatchEvent(new CustomEvent("buxme:open-feedback"));
            }}
          />
        </IosList>
      </IosSection>

      {panel === "profile" && isConfigured ? (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">Profile</p>
          <FormField label="Display name" className="mt-3">
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your name"
            />
          </FormField>
          <Button
            className="mt-3 w-full"
            onClick={() => void handleSaveProfile()}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? "Saving…" : "Save"}
          </Button>
        </IosCard>
      ) : null}

      {panel === "billing" && isConfigured ? (
        <div className="ios-embedded-panel ios-settings-embed">
          <BillingSection />
        </div>
      ) : null}

      {panel === "connections" && isConfigured ? (
        <div className="ios-embedded-panel ios-settings-embed">
          <ConnectedInstitutionsSection />
        </div>
      ) : null}

      {panel === "household" && isConfigured ? (
        <div className="ios-embedded-panel ios-settings-embed">
          <HouseholdSection />
        </div>
      ) : null}

      {panel === "notifications" ? (
        <IosCard padding="md" className="space-y-3">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            Notifications
          </p>
          {(Object.keys(NOTIFICATION_LABELS) as NotificationCategory[]).map(
            (category) => (
              <div
                key={category}
                className="flex min-h-11 items-center justify-between gap-3"
              >
                <p className="text-[14px] text-[var(--foreground)]">
                  {NOTIFICATION_LABELS[category]}
                </p>
                <PreferenceToggle
                  label={NOTIFICATION_LABELS[category]}
                  checked={notificationPrefs[category]}
                  onChange={(enabled) => {
                    const next = { ...notificationPrefs, [category]: enabled };
                    setNotificationPrefs(next);
                    setNotificationPreferences(next);
                    if (profileRepository && user) {
                      void profileRepository
                        .saveNotificationPreferences(user.id, next)
                        .then((saved) => {
                          setNotificationPrefs(saved);
                          syncNotificationPreferencesFromServer(saved);
                        });
                    }
                  }}
                />
              </div>
            ),
          )}
        </IosCard>
      ) : null}

      {panel === "theme" ? (
        <IosCard padding="md">
          <p className="mb-3 text-[15px] font-semibold text-[var(--foreground)]">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {(["dark", "light", "system"] as ThemePreference[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  void triggerHaptic("selection");
                  setTheme(option);
                  setStoredThemePreference(option);
                }}
                className={cn(
                  "min-h-11 rounded-[12px] text-[13px] font-semibold capitalize",
                  theme === option
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white/[0.06] text-[var(--text-muted)]",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </IosCard>
      ) : null}

      {panel === "security" && isConfigured ? (
        <IosCard padding="md" className="space-y-3">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">Security</p>
          <p className="text-[13px] text-[var(--text-muted)]">
            {profileEmail ?? user?.email ?? "—"}
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[var(--accent-light)]"
          >
            Reset password
          </Link>
          <Button
            variant="secondary"
            className="w-full"
            disabled={isSigningOut}
            onClick={() => {
              void (async () => {
                setIsSigningOut(true);
                try {
                  await signOut();
                  router.push("/login");
                } finally {
                  setIsSigningOut(false);
                }
              })();
            }}
          >
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </IosCard>
      ) : null}

      {isDemoMode ? (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">Demo mode</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            You’re exploring sample data.
          </p>
          <Button
            className="mt-3 w-full"
            disabled={isSyncing}
            onClick={() => {
              if (
                window.confirm(
                  "Exit demo mode? Sample data will be removed from this workspace.",
                )
              ) {
                void exitDemoMode().then(() => router.push("/dashboard"));
              }
            }}
          >
            Exit demo mode
          </Button>
        </IosCard>
      ) : null}

      {panel === "delete-account" ? (
        <div
          id="delete-account"
          className="ios-embedded-panel ios-settings-embed"
        >
          <AccountDeletionSection />
        </div>
      ) : null}
    </IosScreen>
  );
}
