import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseConfig } from "@/lib/supabase/config";

export type BudgetOsSupabaseClient = SupabaseClient<Database>;

let browserClient: BudgetOsSupabaseClient | null = null;

export function createSupabaseBrowserClient(): BudgetOsSupabaseClient {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured || !url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient<Database>(url, anonKey) as unknown as BudgetOsSupabaseClient;
}

export function getSupabaseBrowserClient(): BudgetOsSupabaseClient {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }

  return browserClient;
}

export function resetSupabaseBrowserClient() {
  browserClient = null;
}
