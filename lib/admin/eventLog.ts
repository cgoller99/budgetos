import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

export type AdminEventType = "error" | "stripe" | "plaid" | "auth" | "api_failure";

export async function logAdminEvent(
  adminSupabase: BuxmeSupabaseClient,
  input: {
    eventType: AdminEventType;
    message: string;
    metadata?: Record<string, unknown>;
    userId?: string | null;
  },
): Promise<void> {
  try {
    await adminSupabase.from("admin_event_logs").insert({
      event_type: input.eventType,
      message: input.message,
      metadata: input.metadata ?? {},
      user_id: input.userId ?? null,
    });
  } catch (error) {
    console.error("[admin] Failed to write event log", error);
  }
}
