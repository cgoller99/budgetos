import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminEvent, type AdminEventType } from "@/lib/admin/eventLog";

export async function tryLogAdminEvent(input: {
  eventType: AdminEventType;
  message: string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
}): Promise<void> {
  try {
    const adminSupabase = createSupabaseAdminClient();
    await logAdminEvent(adminSupabase, input);
  } catch {
    // Logging should never break primary request handling.
  }
}
