import type {
  DemoProfileId,
  OnboardingMode,
  OnboardingState,
} from "@/lib/onboarding/types";
import { DEFAULT_ONBOARDING_STATE } from "@/lib/onboarding/types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";

export class ProfilesRepository {
  constructor(private readonly supabase: BuxmeSupabaseClient) {}

  async loadOnboardingState(userId: string): Promise<OnboardingState> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("onboarding_complete, onboarding_mode, demo_profile_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return DEFAULT_ONBOARDING_STATE;
    }

    return {
      complete: data.onboarding_complete ?? false,
      mode: (data.onboarding_mode as OnboardingMode | null) ?? null,
      demoProfileId: (data.demo_profile_id as DemoProfileId | null) ?? null,
    };
  }

  async saveOnboardingState(
    userId: string,
    state: OnboardingState,
  ): Promise<OnboardingState> {
    const timestamp = new Date().toISOString();
    const payload = {
      id: userId,
      onboarding_complete: state.complete,
      onboarding_mode: state.mode,
      demo_profile_id: state.demoProfileId,
      updated_at: timestamp,
    };

    const { data, error } = await this.supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("onboarding_complete, onboarding_mode, demo_profile_id")
      .single();

    if (error) {
      throw error;
    }

    const persisted: OnboardingState = {
      complete: data.onboarding_complete ?? false,
      mode: (data.onboarding_mode as OnboardingMode | null) ?? null,
      demoProfileId: (data.demo_profile_id as DemoProfileId | null) ?? null,
    };

    if (
      persisted.complete !== state.complete ||
      persisted.mode !== state.mode ||
      persisted.demoProfileId !== state.demoProfileId
    ) {
      throw new Error(
        "Onboarding state did not persist. Check Supabase profile permissions and migrations.",
      );
    }

    return persisted;
  }

  async loadProfile(userId: string): Promise<{
    fullName: string | null;
    email: string | null;
  }> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return {
      fullName: data?.full_name ?? null,
      email: data?.email ?? null,
    };
  }

  async updateFullName(userId: string, fullName: string): Promise<string> {
    const trimmed = fullName.trim();
    const timestamp = new Date().toISOString();

    const { data, error } = await this.supabase
      .from("profiles")
      .update({
        full_name: trimmed || null,
        updated_at: timestamp,
      })
      .eq("id", userId)
      .select("full_name")
      .single();

    if (error) {
      throw error;
    }

    return data.full_name ?? "";
  }

  async loadNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      if (error.message.includes("notification_preferences")) {
        return DEFAULT_NOTIFICATION_PREFERENCES;
      }
      throw error;
    }

    const stored = data?.notification_preferences as
      | Partial<NotificationPreferences>
      | null
      | undefined;

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...stored,
    };
  }

  async saveNotificationPreferences(
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const timestamp = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("profiles")
      .update({
        notification_preferences: preferences,
        updated_at: timestamp,
      })
      .eq("id", userId)
      .select("notification_preferences")
      .single();

    if (error) {
      if (error.message.includes("notification_preferences")) {
        return preferences;
      }
      throw error;
    }

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(data.notification_preferences as Partial<NotificationPreferences>),
    };
  }
}
