import "server-only";

import { Output, ToolLoopAgent } from "ai";
import { z } from "zod";
import {
  buildAiTeamPlan,
  requiresApprovalForTaskText,
} from "@/lib/ai-team/planner";
import type {
  AiTeamAgentId,
  AiTeamPlan,
  AiTeamSnapshot,
  AiTeamTask,
} from "@/lib/ai-team/types";

const SPECIALIST_MODEL =
  process.env.AI_TEAM_SPECIALIST_MODEL?.trim() || "openai/gpt-5.6-luna";
const ORCHESTRATOR_MODEL =
  process.env.AI_TEAM_ORCHESTRATOR_MODEL?.trim() || "openai/gpt-5.6-sol-fast";
const MODEL_TIMEOUT_MS = 35_000;

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
          owner: z.enum(["chief_of_staff", "engineering", "qa", "analytics"]),
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

const chiefOfStaffAgent = new ToolLoopAgent({
  model: ORCHESTRATOR_MODEL,
  instructions: [
    "You are the Buxme Chief of Staff.",
    "Turn the founder's goal and specialist briefs into a prioritized execution plan.",
    "Use only supplied evidence for factual claims. Never invent metrics or completed work.",
    "Prefer launch-critical, measurable work over feature sprawl.",
    "Production-sensitive actions must be approval-gated.",
  ].join(" "),
  output: chiefOutput,
});
function modelRuntimeAvailable(): boolean {
  if (process.env.AI_TEAM_DISABLE_MODEL === "1") return false;
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL);
}

export function getAiTeamRuntimeInfo() {
  return {
    mode: modelRuntimeAvailable() ? "ai" : "fallback",
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

async function specialistBrief(
  agent: ReturnType<typeof makeSpecialistAgent>,
  goal: string,
  snapshot: AiTeamSnapshot,
) {
  const result = await agent.generate({
    prompt:
      "Founder goal:\n" +
      goal +
      "\n\nEvidence snapshot:\n" +
      snapshotForPrompt(snapshot),
    abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  });

  return result.output;
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
  snapshot: AiTeamSnapshot,
): AiTeamTask {
  const sensitive = requiresApprovalForTaskText(
    input.title + " " + input.objective + " " + (input.approvalReason ?? ""),
  );
  const requiresApproval = input.requiresApproval || sensitive;

  return {
    id: "ai-task-" + (index + 1),
    owner: input.owner,
    title: input.title,
    objective: input.objective,
    status: requiresApproval ? "needs_approval" : "queued",
    evidence: snapshot.observations.slice(0, 3),
    requiresApproval,
    approvalReason: requiresApproval
      ? input.approvalReason ?? "Production-sensitive action requires approval."
      : undefined,
  };
}
function fallbackPlan(goal: string, snapshot: AiTeamSnapshot): AiTeamPlan {
  return {
    ...buildAiTeamPlan(goal, snapshot),
    source: "fallback",
  };
}

export async function createAiTeamPlan(
  goal: string,
  snapshot: AiTeamSnapshot,
): Promise<AiTeamPlan> {
  if (!modelRuntimeAvailable()) {
    return fallbackPlan(goal, snapshot);
  }

  try {
    const [analytics, engineering, qa] = await Promise.all([
      specialistBrief(analyticsAgent, goal, snapshot),
      specialistBrief(engineeringAgent, goal, snapshot),
      specialistBrief(qaAgent, goal, snapshot),
    ]);

    const specialistContext = JSON.stringify(
      { analytics, engineering, qa },
      null,
      2,
    );
    const result = await chiefOfStaffAgent.generate({
      prompt:
        "Founder goal:\n" +
        goal +
        "\n\nEvidence snapshot:\n" +
        snapshotForPrompt(snapshot) +
        "\n\nSpecialist briefs:\n" +
        specialistContext,
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });

    const tasks = result.output.tasks.map((item, index) =>
      taskFromModel(item, index, snapshot),
    );

    return {
      id: "plan-" + Date.now(),
      goal,
      createdAt: new Date().toISOString(),
      summary: result.output.summary,
      observations: snapshot.observations,
      tasks,
      guardrails: [
        "Evidence must be separated from inference.",
        "Unavailable data must be called out instead of invented.",
        "Production writes, payments, customer-impacting actions, and deploys require approval.",
      ],
      source: "ai",
      model: ORCHESTRATOR_MODEL,
    };
  } catch (error) {
    console.error("[ai-team/model] Falling back to deterministic planning", error);
    return fallbackPlan(goal, snapshot);
  }
}
