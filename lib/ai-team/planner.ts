import type {
  AiTeamAgentId,
  AiTeamPlan,
  AiTeamSnapshot,
  AiTeamTask,
} from "@/lib/ai-team/types";

const PRODUCTION_SENSITIVE =
  /\b(deploy|production|release|publish|database|schema|migration|rls|permission|role|grant|revoke|secret|api key|token|subscription|entitlement|payment|stripe|refund|charge|invoice|email|notify|message|customer|user account|delete|remove|disable|enable|reset|factory reset|invite)\b/i;

const EXECUTION_SENSITIVE =
  /\b(implement|modify|change|update|write|run|execute|apply|alter|insert|upsert|drop|truncate|sql|command|rotate|configure|send|contact|approve|publish|release|deploy|restart)\b/i;

const CONTEXTUAL_SENSITIVE =
  /\b(ad spend|marketing spend|increase budget|increase price|decrease price|change pricing|change price|wire funds|send funds|transfer money|issue credit|issue refund|archive (?:customer|user|account)|post (?:the )?campaign|publish (?:the )?campaign|export (?:customer|user) data|download (?:customer|user) data)\b/i;

export function isProductionSensitiveText(value: string): boolean {
  return PRODUCTION_SENSITIVE.test(value);
}

export function requiresApprovalForTaskText(value: string): boolean {
  return (
    isProductionSensitiveText(value) ||
    EXECUTION_SENSITIVE.test(value) ||
    CONTEXTUAL_SENSITIVE.test(value)
  );
}

const ACTION_CAPABLE_OWNERS = new Set<AiTeamAgentId>([
  "engineering",
  "product",
  "growth",
  "customer",
]);

export function requiresApprovalForTaskContext(
  goal: string,
  owner: AiTeamAgentId,
  taskText: string,
): boolean {
  return (
    requiresApprovalForTaskText(taskText) ||
    (ACTION_CAPABLE_OWNERS.has(owner) && requiresApprovalForTaskText(goal))
  );
}

function task(
  id: string,
  owner: AiTeamAgentId,
  title: string,
  objective: string,
  evidence: string[],
  requiresApproval = false,
  approvalReason?: string,
): AiTeamTask {
  return {
    id,
    owner,
    title,
    objective,
    status: requiresApproval ? "needs_approval" : "queued",
    evidence,
    requiresApproval,
    approvalReason,
  };
}
function evidenceForSnapshot(snapshot: AiTeamSnapshot): string[] {
  if (snapshot.observations.length > 0) {
    return snapshot.observations.slice(0, 3);
  }

  return snapshot.unavailableSources.length > 0
    ? [`Unavailable sources: ${snapshot.unavailableSources.join(", ")}`]
    : ["No live observations were available; investigate before making claims."];
}

function isAnalyticsGoal(goal: string): boolean {
  return /growth|retention|activation|onboarding|conversion|revenue|users|usage|churn|analytics|metric|funnel/i.test(goal);
}

function isTechnicalGoal(goal: string): boolean {
  return /bug|fix|build|code|performance|plaid|stripe|auth|ios|api|database|deploy|error|crash|security/i.test(goal);
}

function isQaHeavyGoal(goal: string): boolean {
  return /launch|release|bug|fix|flow|checkout|plaid|ios|signup|login|onboarding|regression|test/i.test(goal);
}

function isProductGoal(goal: string): boolean {
  return /product|ux|ui|onboarding|feature|screen|flow|experience|navigation|paywall|dashboard/i.test(goal);
}

function isGrowthGoal(goal: string): boolean {
  return /growth|marketing|tiktok|\bads?\b|acquisition|conversion|pricing|campaign|landing page|launch message|signup/i.test(goal);
}

function isCustomerGoal(goal: string): boolean {
  return /customer|support|feedback|customer review|app review|complaint|help|ticket|support response|retention/i.test(goal);
}
export function buildAiTeamPlan(goal: string, snapshot: AiTeamSnapshot): AiTeamPlan {
  const normalizedGoal = goal.trim();
  const evidence = evidenceForSnapshot(snapshot);
  const sensitive = isProductionSensitiveText(normalizedGoal);
  const tasks: AiTeamTask[] = [];

  tasks.push(
    task(
      "analytics-baseline",
      "analytics",
      "Establish the measurable baseline",
      isAnalyticsGoal(normalizedGoal)
        ? "Use available Buxme metrics to define the current baseline, target metric, and evidence gaps."
        : "Confirm which metrics can prove the goal succeeded before implementation begins.",
      evidence,
    ),
  );

  const technical = isTechnicalGoal(normalizedGoal);
  const product = isProductGoal(normalizedGoal);
  const growth = isGrowthGoal(normalizedGoal);
  const customer = isCustomerGoal(normalizedGoal);
  const generic = !technical && !product && !growth && !customer;

  if (technical) {
    tasks.push(
      task(
        "engineering-analysis",
        "engineering",
        "Technical implementation review",
        "Inspect the relevant code paths, identify the smallest safe implementation, and produce validation steps.",
        evidence,
        sensitive,
        sensitive ? "The goal references a production-sensitive operation. Execution must stop for approval." : undefined,
      ),
    );
  }

  if (isQaHeavyGoal(normalizedGoal) || technical) {
    tasks.push(
      task(
        "qa-validation",
        "qa",
        "Regression and acceptance plan",
        "Define the critical happy paths, failure cases, and reproducible checks required before release.",
        evidence,
      ),
    );
  }

  if (product || generic) {
    tasks.push(
      task(
        "product-review",
        "product",
        "Product and UX review",
        "Identify the smallest product or UX change that improves the goal without adding feature sprawl.",
        evidence,
      ),
    );
  }

  if (growth) {
    tasks.push(
      task(
        "growth-experiment",
        "growth",
        "Growth experiment design",
        "Define a measurable acquisition, activation, or conversion experiment and its success criteria.",
        evidence,
      ),
    );
  }

  if (customer) {
    tasks.push(
      task(
        "customer-signal-review",
        "customer",
        "Customer signal review",
        "Separate available support evidence from assumptions and identify the highest-value customer response or product follow-up.",
        evidence,
      ),
    );
  }

  tasks.push(
    task(
      "critic-review",
      "critic",
      "Challenge the proposed direction",
      "Attack weak evidence, unnecessary scope, unsafe actions, and assumptions before work is prioritized.",
      evidence,
    ),
  );

  tasks.push(
    task(
      "chief-review",
      "chief_of_staff",
      "Coordinate findings and next action",
      "Combine specialist evidence, challenge unsupported assumptions, prioritize the next move, and surface approvals.",
      evidence,
    ),
  );

  const gatedTasks = tasks.map((item) => {
    const shouldGate = requiresApprovalForTaskContext(
      normalizedGoal,
      item.owner,
      item.title + " " + item.objective,
    );

    if (!shouldGate || item.requiresApproval) return item;

    return {
      ...item,
      status: "needs_approval" as const,
      requiresApproval: true,
      approvalReason: "The requested goal includes an action that requires approval before execution.",
    };
  });

  return {
    id: `plan-${Date.now()}`,
    goal: normalizedGoal,
    createdAt: new Date().toISOString(),
    summary: `Buxme AI Team created ${tasks.length} coordinated task${tasks.length === 1 ? "" : "s"} for this goal.`,
    source: "fallback",
    observations: snapshot.observations,
    tasks: gatedTasks,
    guardrails: [
      "Evidence must be separated from inference.",
      "Unavailable data must be called out instead of invented.",
      "Production writes, payments, customer-impacting actions, and deploys require an approval gate.",
    ],
  };
}
