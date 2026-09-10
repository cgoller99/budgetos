import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { getAiTeamCustomerVoice } from "@/lib/ai-team/customerVoice";
import { listAiTeamExecutionPackets } from "@/lib/ai-team/executionPackets";
import {
  getLatestAiTeamFounderBrief,
  saveAiTeamFounderBrief,
} from "@/lib/ai-team/founderBrief";
import { listAiTeamApprovalDecisions } from "@/lib/ai-team/operations";
import { getAiTeamProductAnalytics } from "@/lib/ai-team/productAnalytics";
import { getAiTeamRevenueIntelligence } from "@/lib/ai-team/revenueIntelligence";
import {
  listAiTeamApprovalRuns,
  listRecentAiTeamRuns,
} from "@/lib/ai-team/runHistory";
import { getAiTeamSnapshot } from "@/lib/ai-team/snapshot";

export async function collectAiTeamFounderBriefInput(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
) {
  const [snapshot, product, revenue, voice, runs, approvalRuns, packets] =
    await Promise.all([
      getAiTeamSnapshot(adminSupabase),
      getAiTeamProductAnalytics(adminSupabase),
      getAiTeamRevenueIntelligence(adminSupabase),
      getAiTeamCustomerVoice(adminSupabase),
      listRecentAiTeamRuns(adminSupabase, userId),
      listAiTeamApprovalRuns(adminSupabase, userId),
      listAiTeamExecutionPackets(adminSupabase, userId),
    ]);

  const decisionTaskIds = [
    ...new Set(
      [...runs, ...approvalRuns].flatMap((run) =>
        run.tasks
          .filter((task) => task.requiresApproval)
          .map((task) => task.id),
      ),
    ),
  ];
  const decisions = await listAiTeamApprovalDecisions(
    adminSupabase,
    decisionTaskIds,
  );
  return {
    snapshot,
    product,
    revenue,
    voice,
    runs,
    approvalRuns,
    decisions,
    packets,
  };
}

export async function generateAiTeamFounderBrief(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
) {
  const input = await collectAiTeamFounderBriefInput(adminSupabase, userId);
  const before = await getLatestAiTeamFounderBrief(adminSupabase, userId);
  const brief = await saveAiTeamFounderBrief(adminSupabase, userId, input);
  return { before, brief, input };
}
