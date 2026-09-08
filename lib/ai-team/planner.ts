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

export function isProductionSensitiveText(value: string): boolean {
  return PRODUCTION_SENSITIVE.test(value);
}

export function requiresApprovalForTaskText(value: string): boolean {
  return isProductionSensitiveText(value) || EXECUTION_SENSITIVE.test(value);
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
  return /growth|retention|activation|onboarding|conversion|revenue|users|usage|churn|analytics/i.test(goal);
}

function isTechnicalGoal(goal: string): boolean {
  return /bug|fix|build|code|performance|plaid|stripe|auth|ios|api|database|deploy|error|crash/i.test(goal);
}

function isQaHeavyGoal(goal: string): boolean {
  return /launch|release|bug|fix|flow|checkout|plaid|ios|signup|login|onboarding/i.test(goal);
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

  if (isTechnicalGoal(normalizedGoal) || !isAnalyticsGoal(normalizedGoal)) {
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
  if (isQaHeavyGoal(normalizedGoal) || tasks.some((item) => item.owner === "engineering")) {
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

  tasks.push(
    task(
      "chief-review",
      "chief_of_staff",
      "Coordinate findings and next action",
      "Combine specialist evidence, challenge unsupported assumptions, prioritize the next move, and surface approvals.",
      evidence,
    ),
  );

  return {
    id: `plan-${Date.now()}`,
    goal: normalizedGoal,
    createdAt: new Date().toISOString(),
    summary: `Buxme AI Team created ${tasks.length} coordinated task${tasks.length === 1 ? "" : "s"} for this goal.`,
    source: "fallback",
    observations: snapshot.observations,
    tasks,
    guardrails: [
      "Evidence must be separated from inference.",
      "Unavailable data must be called out instead of invented.",
      "Production writes, payments, customer-impacting actions, and deploys require an approval gate.",
    ],
  };
}
