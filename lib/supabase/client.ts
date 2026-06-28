import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  createSupabaseBrowserClient,
  getSupabaseBrowserClient,
  resetSupabaseBrowserClient,
  type BuxmeSupabaseClient,
} from "@/lib/supabase/browser";

export type { BuxmeSupabaseClient } from "@/lib/supabase/browser";
export { getSupabaseConfig } from "@/lib/supabase/config";

/** @deprecated Use getSupabaseBrowserClient instead. */
export function createSupabaseClient(): BuxmeSupabaseClient {
  return getSupabaseBrowserClient();
}

/** @deprecated Use getSupabaseBrowserClient instead. */
export function getSupabaseClient(): BuxmeSupabaseClient {
  return getSupabaseBrowserClient();
}

/** @deprecated Use resetSupabaseBrowserClient instead. */
export function resetSupabaseClient() {
  resetSupabaseBrowserClient();
}

export type SupabaseClientType = SupabaseClient<Database>;

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

export { createSupabaseBrowserClient, getSupabaseBrowserClient, resetSupabaseBrowserClient };
