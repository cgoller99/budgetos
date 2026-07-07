import "server-only";

import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin/emails";
import { isFounderEmail } from "@/lib/founder/emails";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AdminApiAuth = {
  user: User;
  supabase: BuxmeSupabaseClient;
  adminSupabase: BuxmeSupabaseClient;
};

export function canAccessAdminDashboard(email: string | null | undefined): boolean {
  return isAdminEmail(email) || isFounderEmail(email);
}

export async function requireAdminApiUser(): Promise<
  AdminApiAuth | { response: NextResponse }
> {
  if (!getSupabaseConfig().isConfigured) {
    return {
      response: NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!canAccessAdminDashboard(user.email)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  let adminSupabase: BuxmeSupabaseClient;

  try {
    adminSupabase = createSupabaseAdminClient();
  } catch (adminError) {
    console.error("[admin] Service role client unavailable", adminError);
    return {
      response: NextResponse.json(
        { error: "Admin backend is not configured." },
        { status: 503 },
      ),
    };
  }

  return { user, supabase, adminSupabase };
}

export async function requireAdminPageUser(): Promise<
  { user: User } | { forbidden: true } | { unauthorized: true } | { misconfigured: true }
> {
  if (!getSupabaseConfig().isConfigured) {
    return { misconfigured: true };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { unauthorized: true };
  }

  if (!canAccessAdminDashboard(user.email)) {
    return { forbidden: true };
  }

  return { user };
}
