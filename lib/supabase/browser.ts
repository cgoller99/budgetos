import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type BuxmeSupabaseClient = SupabaseClient<Database>;

let browserClient: BuxmeSupabaseClient | null = null;

export function createSupabaseBrowserClient(): BuxmeSupabaseClient {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured || !url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient<Database>(url, anonKey) as unknown as BuxmeSupabaseClient;
}

export function getSupabaseBrowserClient(): BuxmeSupabaseClient {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }

  return browserClient;
}

export function resetSupabaseBrowserClient() {
  browserClient = null;
}
