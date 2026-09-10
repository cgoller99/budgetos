import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  getAiTeamActionDefinition,
} from "@/lib/ai-team/actionCommands";
import { getAiTeamCustomerVoice } from "@/lib/ai-team/customerVoice";
import {
  collectAiTeamFounderBriefInput,
} from "@/lib/ai-team/founderBriefRuntime";
import {
  getLatestAiTeamFounderBrief,
  saveAiTeamFounderBrief,
} from "@/lib/ai-team/founderBrief";
import { getAiTeamProductAnalytics } from "@/lib/ai-team/productAnalytics";
import { getAiTeamRevenueIntelligence } from "@/lib/ai-team/revenueIntelligence";
import { getAiTeamSnapshot } from "@/lib/ai-team/snapshot";
import type {
  AiTeamActionExecution,
  AiTeamActionKey,
  AiTeamFounderBrief,
} from "@/lib/ai-team/types";

export class AiTeamActionStoppedError extends Error {
  constructor() {
    super("AI Team action stopped before the next safe execution boundary.");
    this.name = "AiTeamActionStoppedError";
  }
}
function briefSnapshot(brief: AiTeamFounderBrief | null) {
  return brief
    ? {
        id: brief.id,
        briefDate: brief.briefDate,
        source: brief.source,
        updatedAt: brief.updatedAt,
      }
    : null;
}

async function executeIntelligenceRefresh(
  adminSupabase: BuxmeSupabaseClient,
  assertContinue: () => Promise<void>,
): Promise<AiTeamActionExecution> {
  const action = getAiTeamActionDefinition("intelligence.refresh");
  await assertContinue();
  const [snapshot, product, revenue, voice] = await Promise.all([
    getAiTeamSnapshot(adminSupabase),
    getAiTeamProductAnalytics(adminSupabase),
    getAiTeamRevenueIntelligence(adminSupabase),
    getAiTeamCustomerVoice(adminSupabase),
  ]);
  await assertContinue();
  const findings = [
    ...snapshot.observations.slice(0, 4),
    `Product signals available: ${product.signals.filter((signal) => signal.state !== "missing").length}.`,
    revenue.available
      ? `Revenue intelligence refreshed with ${revenue.paidUsers} paid user${revenue.paidUsers === 1 ? "" : "s"}.`
      : "Live revenue intelligence remains unavailable or partial.",
    `Customer voice refreshed from ${voice.total} recent signal${voice.total === 1 ? "" : "s"}.`,
  ].slice(0, 8);

  return {
    action,
    summary: "Buxme operating intelligence was refreshed from current evidence sources.",
    findings,
    changed: false,
    targetType: null,
    targetRef: null,
    changeAction: null,
    beforeSnapshot: null,
    afterSnapshot: null,
    verificationPassed: true,
    verificationSummary:
      "Fresh operating, product, revenue, and customer intelligence completed without a domain write.",
    verificationEvidence: {
      snapshotGeneratedAt: snapshot.generatedAt,
      productGeneratedAt: product.generatedAt,
      revenueGeneratedAt: revenue.generatedAt,
      customerVoiceGeneratedAt: voice.generatedAt,
    },
    refreshedSnapshot: snapshot,
  };
}
async function executeFounderBriefGenerate(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  assertContinue: () => Promise<void>,
): Promise<AiTeamActionExecution> {
  const action = getAiTeamActionDefinition("founder_brief.generate");
  await assertContinue();
  const input = await collectAiTeamFounderBriefInput(adminSupabase, userId);
  const before = await getLatestAiTeamFounderBrief(adminSupabase, userId);
  await assertContinue();

  const brief = await saveAiTeamFounderBrief(adminSupabase, userId, input);
  let after: AiTeamFounderBrief | null = null;
  try {
    after = await getLatestAiTeamFounderBrief(adminSupabase, userId);
  } catch {
    after = null;
  }
  const verified =
    after?.id === brief.id &&
    after.updatedAt === brief.updatedAt &&
    after.generatedBy === userId;

  const findings = [
    ...brief.sections.topPriorities.slice(0, 3),
    ...brief.sections.risks.slice(0, 2),
  ];

  return {
    action,
    summary: verified
      ? `Founder brief for ${brief.briefDate} was generated and verified.`
      : `Founder brief for ${brief.briefDate} was generated, but verification did not match the persisted reload.`,
    findings,
    changed: true,
    targetType: "founder_brief",
    targetRef: brief.id,
    changeAction: before ? "regenerated" : "created",
    beforeSnapshot: briefSnapshot(before),
    afterSnapshot: briefSnapshot(brief),
    verificationPassed: verified,
    verificationSummary: verified
      ? "The founder brief was reloaded after the write and matched the generated record."
      : "The founder brief write returned, but the persisted reload did not match the generated record.",
    verificationEvidence: {
      briefId: brief.id,
      briefDate: brief.briefDate,
      updatedAt: brief.updatedAt,
      generatedByMatches: after?.generatedBy === userId,
    },
    refreshedSnapshot: input.snapshot,
    founderBrief: brief,
  };
}
export async function executeAiTeamRegisteredAction(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  key: AiTeamActionKey,
  assertContinue: () => Promise<void>,
): Promise<AiTeamActionExecution> {
  if (key === "intelligence.refresh") {
    return executeIntelligenceRefresh(adminSupabase, assertContinue);
  }
  if (key === "founder_brief.generate") {
    return executeFounderBriefGenerate(
      adminSupabase,
      userId,
      assertContinue,
    );
  }
  throw new Error("No executor is registered for this AI Team action.");
}
