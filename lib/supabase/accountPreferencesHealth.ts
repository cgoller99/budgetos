import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapAccountRow } from "@/lib/supabase/mappers";
import type { AccountRow } from "@/lib/supabase/database.types";

const TEST_ACCOUNT_NAME = "__buxme_pref_probe__";

export type AccountPreferencesPersistenceHealth = {
  checked: boolean;
  passed: boolean;
  error: string | null;
};

export async function verifyAccountPreferencesPersistence(): Promise<AccountPreferencesPersistenceHealth> {
  try {
    const admin = createSupabaseAdminClient();

    const { data: owner, error: ownerError } = await admin
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (ownerError || !owner?.id) {
      return {
        checked: false,
        passed: false,
        error: ownerError?.message ?? "No profile available for persistence probe.",
      };
    }

    const testId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const probeValues = {
      nickname: "Probe Nickname",
      icon: "🎯",
      color: "violet",
      include_in_net_worth: false,
      include_in_safe_to_spend: false,
      is_hidden: true,
      archived_at: timestamp,
    };

    const { error: insertError } = await admin.from("accounts").insert({
      id: testId,
      user_id: owner.id,
      record_kind: "account",
      name: TEST_ACCOUNT_NAME,
      institution: "Buxme Probe",
      type: "checking",
      balance: 0,
      monthly_change: 0,
      ...probeValues,
    });

    if (insertError) {
      return {
        checked: true,
        passed: false,
        error: insertError.message,
      };
    }

    const { data: row, error: readError } = await admin
      .from("accounts")
      .select("*")
      .eq("id", testId)
      .single();

    await admin.from("accounts").delete().eq("id", testId);

    if (readError || !row) {
      return {
        checked: true,
        passed: false,
        error: readError?.message ?? "Probe account could not be read back.",
      };
    }

    const mapped = mapAccountRow(row as AccountRow);
    const passed =
      mapped.nickname === probeValues.nickname &&
      mapped.icon === probeValues.icon &&
      mapped.color === probeValues.color &&
      mapped.includeInNetWorth === probeValues.include_in_net_worth &&
      mapped.includeInSafeToSpend === probeValues.include_in_safe_to_spend &&
      mapped.isHidden === probeValues.is_hidden &&
      mapped.archivedAt !== null;

    return {
      checked: true,
      passed,
      error: passed ? null : "Read-back values did not match written preferences.",
    };
  } catch (error) {
    return {
      checked: false,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
