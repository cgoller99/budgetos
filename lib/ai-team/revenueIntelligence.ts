import "server-only";

import { getAdminRevenueMetrics } from "@/lib/admin/revenueService";
import { deriveRevenueIntelligence } from "@/lib/ai-team/v3Math";
import { PLAN_DEFINITIONS } from "@/lib/subscription/plans";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

function monthlyPrice(plan: "pro" | "pro_plus", fallback: number): number {
  const label = PLAN_DEFINITIONS.find((item) => item.id === plan)?.priceLabel;
  const parsed = Number(label?.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getAiTeamRevenueIntelligence(
  adminSupabase: BuxmeSupabaseClient,
) {
  const metrics = await getAdminRevenueMetrics(adminSupabase);
  return deriveRevenueIntelligence(metrics, {
    pro: monthlyPrice("pro", 7.99),
    proPlus: monthlyPrice("pro_plus", 14.99),
  });
}
