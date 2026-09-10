import "server-only";

import { Output, ToolLoopAgent } from "ai";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import { z } from "zod";
import {
  buildAiTeamPlan,
  requiresApprovalForTaskContext,
} from "@/lib/ai-team/planner";
import {
  selectAiTeamSpecialists,
  type RoutedSpecialistId,
} from "@/lib/ai-team/routing";
import type {
  AiTeamAgentId,
  AiTeamPlan,
  AiTeamProgressEvent,
  AiTeamRuntimeMetadata,
  AiTeamSnapshot,
  AiTeamTask,
} from "@/lib/ai-team/types";

const SPECIALIST_MODEL =
  process.env.AI_TEAM_SPECIALIST_MODEL?.trim() || "openai/gpt-5.6-luna";
const ORCHESTRATOR_MODEL =
  process.env.AI_TEAM_ORCHESTRATOR_MODEL?.trim() || "openai/gpt-5.6-sol-fast";
const MODEL_TIMEOUT_MS = 35_000;

export type AiTeamProgressCallback = (
  event: AiTeamProgressEvent,
) => void | Promise<void>;

const AGENT_ACTIVITY_LABELS: Record<AiTeamAgentId, string> = {
  chief_of_staff: "Chief of Staff",
  engineering: "Engineering",
  qa: "QA",
  analytics: "Analytics",
  product: "Product",
  growth: "Growth",
  customer: "Customer",
  critic: "Critic",
};

type CompletedAgentOutput =
  | {
      kind: "specialist" | "critic";
      summary: string;
      recommendations: Array<{ title: string }>;
    }
  | {
      kind: "chief";
      summary: string;
      tasks: Array<{ title: string }>;
    };

const PRIVATE_REASONING_PATTERN =
  /\b(chain[- ]?of[- ]?thought|hidden reasoning|private reasoning|internal reasoning|thought process|scratchpad|system[- ]prompt|developer[- ]message|step[- ]?by[- ]?step reasoning)\b/i;

function conciseOutputText(value: string, maximum: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (PRIVATE_REASONING_PATTERN.test(compact)) {
    return "Report completed. Private reasoning content was withheld from the operational debrief.";
  }
  if (compact.length <= maximum) return compact;
  return `${compact.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

export function formatCompletedAgentOutput(
  output: CompletedAgentOutput,
): string {
  const summary = conciseOutputText(output.summary, 540);
  const titles =
    output.kind === "chief"
      ? output.tasks.slice(0, 4).map((task) => task.title)
      : output.recommendations
          .slice(0, 3)
          .map((recommendation) => recommendation.title);
  const titleLabel =
    output.kind === "chief"
      ? "Final tasks"
      : output.kind === "critic"
        ? "Challenges / recommendations"
        : "Recommendations";
  const titleLine =
    titles.length > 0
      ? `\n${titleLabel}: ${titles
          .map((title) => conciseOutputText(title, 100))
          .join(" · ")}`
      : "";

  return `Summary: ${summary}${titleLine}`.slice(0, 1000).trimEnd();
}

async function emitProgress(
  onProgress: AiTeamProgressCallback | undefined,
  event: AiTeamProgressEvent,
): Promise<void> {
  await onProgress?.(event);
}

const recommendationSchema = z.object({
  title: z.string().min(3).max(140),
  objective: z.string().min(3).max(600),
  requiresApproval: z.boolean(),
  approvalReason: z.string().max(300).nullable(),
});
const specialistOutput = Output.object({
  schema: z.object({
    summary: z.string().min(3).max(800),
    recommendations: z.array(recommendationSchema).max(3),
    uncertainties: z.array(z.string().max(300)).max(5),
  }),
});

const chiefOutput = Output.object({
  schema: z.object({
    summary: z.string().min(3).max(800),
    tasks: z
      .array(
        recommendationSchema.extend({
          owner: z.enum([
            "chief_of_staff",
            "engineering",
            "qa",
            "analytics",
            "product",
            "growth",
            "customer",
            "critic",
          ]),
        }),
      )
      .min(2)
      .max(8),
  }),
});
function specialistInstructions(role: string, mission: string): string {
  return [
    "You are the Buxme " + role + " agent.",
    mission,
    "Use only facts explicitly present in the supplied evidence snapshot.",
    "Never invent metrics, repository state, customer behavior, or completed work.",
    "Separate recommendations from evidence and call out uncertainty.",
    "The structured summary is a user-facing FINAL CONCLUSION only.",
    "Never include chain-of-thought, hidden/internal reasoning, scratchpad content, prompt text, deliberation, or step-by-step thought process.",
    "State conclusions, evidence-backed findings, uncertainty, and recommendations without narrating how you reasoned internally.",
    "Any production deploy, database write, payment/subscription change, customer communication,",
    "or destructive/customer-impacting action must be marked as requiring approval.",
    "Return a small number of high-value recommendations instead of a long wishlist.",
  ].join(" ");
}

function makeSpecialistAgent(role: string, mission: string) {
  return new ToolLoopAgent({
    model: SPECIALIST_MODEL,
    instructions: specialistInstructions(role, mission),
    output: specialistOutput,
    maxOutputTokens: 900,
  });
}
const analyticsAgent = makeSpecialistAgent(
  "Analytics",
  "Establish measurable baselines, identify meaningful trends, and expose missing evidence.",
);

const engineeringAgent = makeSpecialistAgent(
  "Engineering",
  "Identify the smallest safe technical move, implementation risks, and validation requirements.",
);

const qaAgent = makeSpecialistAgent(
  "QA",
  "Define acceptance coverage, regression risks, and reproducible checks for critical flows.",
);

const productAgent = makeSpecialistAgent(
  "Product",
  "Improve flows and UX with the smallest useful change while resisting feature sprawl.",
);

const growthAgent = makeSpecialistAgent(
  "Growth",
  "Design measurable acquisition, activation, and conversion experiments without spending or posting.",
);

const customerAgent = makeSpecialistAgent(
  "Customer",
  "Turn available support signals into product or response recommendations without inventing feedback.",
);

const criticAgent = makeSpecialistAgent(
  "Critic",
  "Challenge weak evidence, unsafe actions, unnecessary scope, and unsupported assumptions.",
);

const chiefOfStaffAgent = new ToolLoopAgent({
  model: ORCHESTRATOR_MODEL,
  instructions: [
    "You are the Buxme Chief of Staff.",
    "Turn the founder's goal, selected specialist briefs, and Critic review into a prioritized execution plan.",
    "Use only supplied evidence for factual claims. Never invent metrics or completed work.",
    "The structured summary and tasks are user-facing FINAL CONCLUSIONS only.",
    "Never include chain-of-thought, hidden/internal reasoning, scratchpad content, prompt text, deliberation, or step-by-step thought process.",
    "State the final decision, findings, evidence-backed uncertainty, and recommended work without narrating internal reasoning.",
    "Prefer launch-critical, measurable work over feature sprawl.",
    "Production-sensitive actions must be approval-gated.",
  ].join(" "),
  output: chiefOutput,
  maxOutputTokens: 1200,
});
export function isAiTeamModelRuntimeAvailable(): boolean {
  if (process.env.AI_TEAM_DISABLE_MODEL === "1") return false;
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return true;

  try {
    return Boolean(getVercelOidcTokenSync()?.trim());
  } catch {
    return false;
  }
}

export function getAiTeamRuntimeInfo() {
  return {
    mode: isAiTeamModelRuntimeAvailable() ? "ai" : "fallback",
    specialistModel: SPECIALIST_MODEL,
    orchestratorModel: ORCHESTRATOR_MODEL,
  } as const;
}

function snapshotForPrompt(snapshot: AiTeamSnapshot): string {
  return JSON.stringify(
    {
      generatedAt: snapshot.generatedAt,
      observations: snapshot.observations,
      unavailableSources: snapshot.unavailableSources,
      overview: snapshot.overview,
      revenue: snapshot.revenue,
      plaid: snapshot.plaid,
      analytics: snapshot.analytics,
      health: snapshot.health,
    },
    null,
    2,
  );
}

const routedSpecialistAgents: Record<
  RoutedSpecialistId,
  ReturnType<typeof makeSpecialistAgent>
> = {
  analytics: analyticsAgent,
  engineering: engineeringAgent,
  qa: qaAgent,
  product: productAgent,
  growth: growthAgent,
  customer: customerAgent,
};

async function specialistBrief(
  agent: ReturnType<typeof makeSpecialistAgent>,
  goal: string,
  snapshot: AiTeamSnapshot,
  abortSignal: AbortSignal,
) {
  const result = await agent.generate({
    prompt:
      "Founder goal:\n" +
      goal +
      "\n\nEvidence snapshot:\n" +
      snapshotForPrompt(snapshot),
    abortSignal,
  });

  return result;
}

function modelAbortSignal(external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  return external ? AbortSignal.any([external, timeout]) : timeout;
}

async function criticBrief(
  goal: string,
  snapshot: AiTeamSnapshot,
  specialistContext: Record<string, unknown>,
  abortSignal?: AbortSignal,
) {
  const result = await criticAgent.generate({
    prompt:
      "Founder goal:\n" +
      goal +
      "\n\nEvidence snapshot:\n" +
      snapshotForPrompt(snapshot) +
      "\n\nSpecialist briefs to challenge:\n" +
      JSON.stringify(specialistContext, null, 2),
    abortSignal: modelAbortSignal(abortSignal),
  });

  return result;
}

type GenerationTelemetry = {
  usage: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
  };
  steps: unknown[];
};

function runtimeMetadata(
  selectedSpecialists: RoutedSpecialistId[],
  generations: GenerationTelemetry[],
  startedAt: number,
): AiTeamRuntimeMetadata {
  const sumAvailable = (
    field: "inputTokens" | "outputTokens" | "totalTokens",
  ): number | undefined => {
    const values = generations
      .map((generation) => generation.usage[field])
      .filter((value): value is number => typeof value === "number");
    return values.length > 0
      ? values.reduce((total, value) => total + value, 0)
      : undefined;
  };

  return {
    selectedSpecialists,
    modelCallCount: generations.reduce(
      (total, generation) => total + generation.steps.length,
      0,
    ),
    durationMs: Math.max(0, Date.now() - startedAt),
    inputTokens: sumAvailable("inputTokens"),
    outputTokens: sumAvailable("outputTokens"),
    totalTokens: sumAvailable("totalTokens"),
  };
}

function taskFromModel(
  input: {
    owner: AiTeamAgentId;
    title: string;
    objective: string;
    requiresApproval: boolean;
    approvalReason: string | null;
  },
  index: number,
  goal: string,
  snapshot: AiTeamSnapshot,
): AiTeamTask {
  const sensitive = requiresApprovalForTaskContext(
    goal,
    input.owner,
    input.title + " " + input.objective + " " + (input.approvalReason ?? ""),
  );
  const requiresApproval = input.requiresApproval || sensitive;

  return {
    id: "ai-task-" + (index + 1),
    owner: input.owner,
    title: conciseOutputText(input.title, 140),
    objective: conciseOutputText(input.objective, 600),
    status: requiresApproval ? "needs_approval" : "queued",
    evidence: [
      ...snapshot.observations.slice(0, 3),
      ...(snapshot.unavailableSources.length > 0
        ? [`Unavailable sources: ${snapshot.unavailableSources.join(", ")}`]
        : []),
      ...(snapshot.revenue && !snapshot.revenue.available
        ? ["Stripe live revenue data is unavailable or partial."]
        : []),
      ...(snapshot.plaid && !snapshot.plaid.available
        ? ["Plaid live connection data is unavailable."]
        : []),
    ].slice(0, 5),
    requiresApproval,
    approvalReason: requiresApproval
      ? conciseOutputText(input.approvalReason ?? "", 300) ||
        "Production-sensitive action requires approval."
      : undefined,
  };
}
function fallbackPlan(goal: string, snapshot: AiTeamSnapshot): AiTeamPlan {
  return {
    ...buildAiTeamPlan(goal, snapshot),
    source: "fallback",
  };
}

function throwIfMissionAborted(abortSignal?: AbortSignal): void {
  if (!abortSignal?.aborted) return;
  throw abortSignal.reason instanceof Error
    ? abortSignal.reason
    : new Error("AI Team mission was aborted.");
}

export async function createAiTeamPlan(
  goal: string,
  snapshot: AiTeamSnapshot,
  onProgress?: AiTeamProgressCallback,
  abortSignal?: AbortSignal,
): Promise<AiTeamPlan> {
  throwIfMissionAborted(abortSignal);
  const startedAt = Date.now();
  const selectedSpecialists = selectAiTeamSpecialists(goal);
  await emitProgress(onProgress, {
    phase: "routing",
    status: "completed",
    label: "Agents routed",
    detail: `Selected ${selectedSpecialists
      .map((id) => `${AGENT_ACTIVITY_LABELS[id]} (${id})`)
      .join(", ")}, Critic (critic), and Chief of Staff (chief_of_staff).`,
  });
  throwIfMissionAborted(abortSignal);

  if (!isAiTeamModelRuntimeAvailable()) {
    throwIfMissionAborted(abortSignal);
    await emitProgress(onProgress, {
      phase: "fallback",
      status: "warning",
      label: "Safe planning fallback active",
      detail:
        "The model runtime is unavailable; the deterministic evidence-first planner is being used.",
    });
    throwIfMissionAborted(abortSignal);
    return {
      ...fallbackPlan(goal, snapshot),
      runtimeMetadata: {
        selectedSpecialists,
        modelCallCount: 0,
        durationMs: Math.max(0, Date.now() - startedAt),
      },
    };
  }

  const completedGenerations: GenerationTelemetry[] = [];
  try {
    const specialistAbortController = new AbortController();
    const specialistTimeout = setTimeout(
      () =>
        specialistAbortController.abort(
          new Error("AI Team specialist generation timed out."),
        ),
      MODEL_TIMEOUT_MS,
    );
    const specialistSignal = abortSignal
      ? AbortSignal.any([specialistAbortController.signal, abortSignal])
      : specialistAbortController.signal;
    const specialistPromises = selectedSpecialists.map(async (id) => {
      await emitProgress(onProgress, {
        phase: "specialist",
        agentId: id,
        status: "running",
        label: `${AGENT_ACTIVITY_LABELS[id]} active`,
        detail: "Reviewing the available evidence for this command.",
      });
      try {
        const generation = await specialistBrief(
          routedSpecialistAgents[id],
          goal,
          snapshot,
          specialistSignal,
        );
        completedGenerations.push(generation);
        await emitProgress(onProgress, {
          phase: "specialist",
          agentId: id,
          status: "completed",
          label: `${AGENT_ACTIVITY_LABELS[id]} completed`,
          detail: formatCompletedAgentOutput({
            kind: "specialist",
            summary: generation.output.summary,
            recommendations: generation.output.recommendations,
          }),
        });
        return [id, generation] as const;
      } catch (error) {
        await emitProgress(onProgress, {
          phase: "specialist",
          agentId: id,
          status: "failed",
          label: `${AGENT_ACTIVITY_LABELS[id]} did not complete`,
          detail: "The specialist runtime stopped before producing a usable result.",
        });
        specialistAbortController.abort(error);
        throw error;
      }
    });
    let briefEntries: Awaited<(typeof specialistPromises)[number]>[];
    try {
      briefEntries = await Promise.all(specialistPromises);
    } catch (error) {
      await Promise.allSettled(specialistPromises);
      throw error;
    } finally {
      clearTimeout(specialistTimeout);
    }

    const specialistBriefs = Object.fromEntries(
      briefEntries.map(([id, result]) => [id, result.output]),
    ) as Record<
      string,
      unknown
    >;
    await emitProgress(onProgress, {
      phase: "critic",
      agentId: "critic",
      status: "running",
      label: "Critic reviewing",
      detail: "Challenging scope, evidence quality, and operational risk.",
    });
    let criticResult: Awaited<ReturnType<typeof criticBrief>>;
    try {
      criticResult = await criticBrief(
        goal,
        snapshot,
        specialistBriefs,
        abortSignal,
      );
    } catch (error) {
      await emitProgress(onProgress, {
        phase: "critic",
        agentId: "critic",
        status: "failed",
        label: "Critic review did not complete",
        detail: "The reviewer runtime stopped before producing a usable result.",
      });
      throw error;
    }
    completedGenerations.push(criticResult);
    await emitProgress(onProgress, {
      phase: "critic",
      agentId: "critic",
      status: "completed",
      label: "Critic review completed",
      detail: formatCompletedAgentOutput({
        kind: "critic",
        summary: criticResult.output.summary,
        recommendations: criticResult.output.recommendations,
      }),
    });
    const critic = criticResult.output;
    const specialistContext = JSON.stringify(
      { ...specialistBriefs, critic },
      null,
      2,
    );

    await emitProgress(onProgress, {
      phase: "chief",
      agentId: "chief_of_staff",
      status: "running",
      label: "Chief synthesizing",
      detail: "Prioritizing reviewed findings into the final plan.",
    });
    let result: Awaited<ReturnType<typeof chiefOfStaffAgent.generate>>;
    try {
      result = await chiefOfStaffAgent.generate({
        prompt:
          "Founder goal:\n" +
          goal +
          "\n\nEvidence snapshot:\n" +
          snapshotForPrompt(snapshot) +
          "\n\nSpecialist briefs:\n" +
          specialistContext,
        abortSignal: modelAbortSignal(abortSignal),
      });
    } catch (error) {
      await emitProgress(onProgress, {
        phase: "chief",
        agentId: "chief_of_staff",
        status: "failed",
        label: "Chief synthesis did not complete",
        detail: "The orchestrator runtime stopped before producing a usable plan.",
      });
      throw error;
    }
    completedGenerations.push(result);
    await emitProgress(onProgress, {
      phase: "chief",
      agentId: "chief_of_staff",
      status: "completed",
      label: "Chief synthesis completed",
      detail: formatCompletedAgentOutput({
        kind: "chief",
        summary: result.output.summary,
        tasks: result.output.tasks,
      }),
    });

    const tasks = result.output.tasks.map((item, index) =>
      taskFromModel(item, index, goal, snapshot),
    );

    return {
      id: "plan-" + Date.now(),
      goal,
      createdAt: new Date().toISOString(),
      summary: conciseOutputText(result.output.summary, 800),
      observations: snapshot.observations,
      tasks,
      guardrails: [
        "Evidence must be separated from inference.",
        "Unavailable data must be called out instead of invented.",
        "Production writes, payments, customer-impacting actions, and deploys require approval.",
      ],
      source: "ai",
      model: ORCHESTRATOR_MODEL,
      runtimeMetadata: runtimeMetadata(
        selectedSpecialists,
        completedGenerations,
        startedAt,
      ),
    };
  } catch (error) {
    if (abortSignal?.aborted) {
      await emitProgress(onProgress, {
        phase: "control",
        status: "warning",
        label: "Model work interrupted",
        detail:
          "The active model request stopped after the mission request was interrupted.",
      }).catch(() => undefined);
      throw abortSignal.reason instanceof Error
        ? abortSignal.reason
        : new Error("AI Team mission was aborted.");
    }
    console.error("[ai-team/model] Falling back to deterministic planning", error);
    await emitProgress(onProgress, {
      phase: "fallback",
      status: "warning",
      label: "Model runtime fallback engaged",
      detail:
        "A model step did not complete; the deterministic evidence-first planner produced the plan.",
    });
    throwIfMissionAborted(abortSignal);
    return {
      ...fallbackPlan(goal, snapshot),
      runtimeMetadata: runtimeMetadata(
        selectedSpecialists,
        completedGenerations,
        startedAt,
      ),
    };
  }
}
