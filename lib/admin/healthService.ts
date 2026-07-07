import "server-only";

import { getPlaidConfig, getPlaidEnvironmentLabel, resolvePlaidWebhookUrl } from "@/lib/plaid/config";
import { isStripeEnabled } from "@/lib/stripe/config";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

import type { AdminHealthCheck, AdminEventLogEntry, HealthStatus } from "@/lib/admin/types";
import type { AdminEventType } from "@/lib/admin/eventLog";

export type { AdminHealthCheck, AdminEventLogEntry } from "@/lib/admin/types";

export async function getAdminSystemHealth(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AdminHealthCheck[]> {
  const checks: AdminHealthCheck[] = [];

  const supabaseConfig = getSupabaseConfig();
  let databaseStatus: HealthStatus = "red";
  let databaseDetail = "Supabase is not configured.";

  if (supabaseConfig.isConfigured) {
    const { error } = await adminSupabase.from("profiles").select("id", { head: true, count: "exact" });
    if (error) {
      databaseStatus = "red";
      databaseDetail = error.message;
    } else {
      databaseStatus = "green";
      databaseDetail = "Connected";
    }
  }

  checks.push({
    id: "database",
    label: "Database",
    status: databaseStatus,
    detail: databaseDetail,
  });

  checks.push({
    id: "stripe",
    label: "Stripe",
    status: isStripeEnabled() ? "green" : "yellow",
    detail: isStripeEnabled() ? "Configured" : "Missing keys or price configuration",
  });

  const plaidConfig = getPlaidConfig();
  const plaidEnvironmentLabel =
    plaidConfig.configurationError === null
      ? getPlaidEnvironmentLabel(plaidConfig.environment)
      : null;

  checks.push({
    id: "plaid",
    label: "Plaid",
    status: plaidConfig.configurationError
      ? process.env.VERCEL_ENV === "production" &&
        plaidConfig.environment === "sandbox"
        ? "red"
        : "yellow"
      : "green",
    detail:
      plaidConfig.configurationError ??
      (plaidEnvironmentLabel
        ? `Configured (${plaidEnvironmentLabel}, ${resolvePlaidWebhookUrl(plaidConfig)})`
        : "Configured"),
  });

  checks.push({
    id: "resend",
    label: "Resend",
    status: process.env.RESEND_API_KEY?.trim() ? "green" : "yellow",
    detail: process.env.RESEND_API_KEY?.trim() ? "API key present" : "Missing RESEND_API_KEY",
  });

  checks.push({
    id: "vercel",
    label: "Vercel",
    status: process.env.VERCEL ? "green" : "yellow",
    detail: process.env.VERCEL ? "Running on Vercel" : "Local or unknown host",
  });

  return checks;
}

export async function listAdminEventLogs(
  adminSupabase: BuxmeSupabaseClient,
  eventType?: AdminEventType,
): Promise<AdminEventLogEntry[]> {
  let query = adminSupabase
    .from("admin_event_logs")
    .select("id, event_type, message, metadata, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    message: row.message,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    userId: row.user_id,
    createdAt: row.created_at,
  }));
}
