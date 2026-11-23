import "server-only";

import { canAccessAdminDashboard } from "@/lib/admin/apiAuth";
import { decideJarvisAdmin } from "../../apps/jarvis/lib/buxmeAccess.mjs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function verifyJarvisAdmin() {
  if (!getSupabaseConfig().isConfigured) {
    return { ok: false as const, status: 503, error: "Buxme sign-in is not configured." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) return { ok: false as const, status: 401, error: "Sign in to Buxme first." };

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { ok: false as const, status: 503, error: "Admin authorization is not configured." };
  }

  const lookup = await admin.auth.admin.getUserById(user.id);
  const record = lookup.data?.user;
  const { data: profile } = await admin.from("profiles").select("id, email").eq("id", user.id).maybeSingle();

  return decideJarvisAdmin({
    sessionUser: { id: user.id, email: user.email },
    authUser: record ? { id: record.id, email: record.email } : null,
    profile: profile ? { id: profile.id, email: profile.email } : null,
    adminAuthorized: canAccessAdminDashboard(record?.email),
  });
}
