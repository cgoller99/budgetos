import type {
  DemoProfileId,
  OnboardingMode,
  OnboardingState,
} from "@/lib/onboarding/types";
import { DEFAULT_ONBOARDING_STATE } from "@/lib/onboarding/types";
import type { BudgetOsSupabaseClient } from "@/lib/supabase/client";

export class ProfilesRepository {
  constructor(private readonly supabase: BudgetOsSupabaseClient) {}

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
}
