import type {
  AiTeamApprovalDecision,
  AiTeamRun,
  AiTeamSnapshot,
} from "@/lib/ai-team/types";

export type AiTeamScore = {
  score: number;
  contributors: string[];
  missingEvidence: string[];
};

export type AiTeamSuggestion = {
  title: string;
  goal: string;
  severity: "high" | "medium" | "low";
  impact: number;
};

export function evidenceAvailability(snapshot: AiTeamSnapshot) {
  const unavailable = new Set(snapshot.unavailableSources);
  return {
    overview: snapshot.overview !== null && !unavailable.has("overview"),
    revenue:
      snapshot.revenue?.available === true && !unavailable.has("revenue"),
    plaid: snapshot.plaid?.available === true && !unavailable.has("plaid"),
    analytics: snapshot.analytics !== null && !unavailable.has("analytics"),
    health: snapshot.health.length > 0 && !unavailable.has("health"),
  };
}

function freshnessPoints(generatedAt: string, maximum: number): number {
  const age = Date.now() - new Date(generatedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return 0;
  if (age <= 5 * 60_000) return maximum;
  if (age <= 60 * 60_000) return Math.round(maximum * 0.75);
  if (age <= 24 * 60 * 60_000) return Math.round(maximum * 0.4);
  return 0;
}

export function operatingHealthScore(snapshot: AiTeamSnapshot): AiTeamScore {
  const availability = evidenceAvailability(snapshot);
  const sourceCount = Object.values(availability).filter(Boolean).length;
  const greenCount = snapshot.health.filter((check) => check.status === "green").length;
  const healthPoints =
    snapshot.health.length > 0
      ? Math.round((greenCount / snapshot.health.length) * 30)
      : 0;
  const freshness = freshnessPoints(snapshot.generatedAt, 20);
  const score = sourceCount * 10 + healthPoints + freshness;
  const missingEvidence = Object.entries(availability)
    .filter(([, available]) => !available)
    .map(([source]) => source);

  return {
    score: Math.min(100, score),
    contributors: [
      `${sourceCount}/5 evidence sources healthy (+${sourceCount * 10})`,
      `${greenCount}/${snapshot.health.length} health checks green (+${healthPoints})`,
      `Evidence freshness (+${freshness})`,
    ],
    missingEvidence,
  };
}

export function launchReadinessScore(
  snapshot: AiTeamSnapshot,
  runs: AiTeamRun[],
  decisions: AiTeamApprovalDecision[],
  approvalRuns: AiTeamRun[] = runs,
): AiTeamScore {
  const availability = evidenceAvailability(snapshot);
  const sourceCount = Object.values(availability).filter(Boolean).length;
  const greenCount = snapshot.health.filter((check) => check.status === "green").length;
  const healthPoints =
    snapshot.health.length > 0
      ? Math.round((greenCount / snapshot.health.length) * 20)
      : 0;
  const recentQa = runs.some(
    (run) =>
      Date.now() - new Date(run.createdAt).getTime() <= 7 * 86_400_000 &&
      run.tasks.some((task) => task.owner === "qa"),
  );
  const decidedTaskIds = new Set(decisions.map((decision) => decision.taskId));
  const openApprovals = approvalRuns
    .flatMap((run) => run.tasks)
    .filter(
      (task) =>
        task.requiresApproval &&
        task.status === "needs_approval" &&
        !decidedTaskIds.has(task.id),
    ).length;
  const sourcePoints = sourceCount * 8;
  const freshness = freshnessPoints(snapshot.generatedAt, 10);
  const qaPoints = recentQa ? 20 : 0;
  const approvalPoints = openApprovals === 0 ? 10 : 0;

  return {
    score: Math.min(
      100,
      sourcePoints + healthPoints + freshness + qaPoints + approvalPoints,
    ),
    contributors: [
      `${sourceCount}/5 evidence sources healthy (+${sourcePoints})`,
      `${greenCount}/${snapshot.health.length} health checks green (+${healthPoints})`,
      `Evidence freshness (+${freshness})`,
      `Recent QA planning ${recentQa ? "available (+20)" : "missing (+0)"}`,
      `Open approval gates ${openApprovals} (+${approvalPoints})`,
    ],
    missingEvidence: [
      ...Object.entries(availability)
        .filter(([, available]) => !available)
        .map(([source]) => source),
      ...(!recentQa ? ["recent QA planning"] : []),
      ...(openApprovals > 0 ? [`${openApprovals} unresolved approval gates`] : []),
    ],
  };
}

export function operatingSuggestions(
  snapshot: AiTeamSnapshot,
  runs: AiTeamRun[],
): AiTeamSuggestion[] {
  const suggestions: AiTeamSuggestion[] = [];
  const unavailable = Object.entries(evidenceAvailability(snapshot))
    .filter(([, available]) => !available)
    .map(([source]) => source);
  const unhealthy = snapshot.health.filter((check) => check.status !== "green");

  if (unhealthy.length > 0) {
    suggestions.push({
      title: "Investigate degraded system health",
      goal: `Review the available evidence for ${unhealthy.map((check) => check.label).join(", ")} and produce a read-only remediation plan.`,
      severity: "high",
      impact: 100,
    });
  }
  if (unavailable.length > 0) {
    suggestions.push({
      title: "Close evidence gaps",
      goal: `Investigate why ${unavailable.join(", ")} evidence is unavailable without inferring missing values.`,
      severity: "high",
      impact: 90,
    });
  }
  if (snapshot.plaid?.available) {
    suggestions.push({
      title: snapshot.plaid.failedSyncs > 0 ? "Review Plaid failures" : "Validate Plaid health",
      goal: "Analyze current Plaid connection evidence and recommend the safest read-only next step.",
      severity: snapshot.plaid.failedSyncs > 0 ? "high" : "low",
      impact: snapshot.plaid.failedSyncs > 0 ? 85 : 45,
    });
  }
  if (snapshot.revenue?.available && snapshot.revenue.failedPayments > 0) {
    suggestions.push({
      title: "Analyze failed payments",
      goal: "Analyze failed-payment patterns using current evidence without changing subscriptions or contacting customers.",
      severity: "medium",
      impact: 75,
    });
  }
  if (
    snapshot.overview &&
    snapshot.overview.totalBugReports + snapshot.overview.totalFeedbackReports > 0
  ) {
    suggestions.push({
      title: "Synthesize customer signals",
      goal: "Group current bug and feedback evidence into themes and recommend one planning-only next move.",
      severity: "medium",
      impact: 65,
    });
  }
  if (!runs.some((run) => run.tasks.some((task) => task.owner === "qa"))) {
    suggestions.push({
      title: "Establish a release QA baseline",
      goal: "Create a focused release QA plan for Buxme critical flows and identify missing evidence.",
      severity: "medium",
      impact: 70,
    });
  }
  if (suggestions.length < 3) {
    suggestions.push({
      title: "Review operating trends",
      goal: "Review available 30-day operating trends and identify the highest-impact measurable opportunity.",
      severity: "low",
      impact: 40,
    });
  }

  return suggestions.sort((a, b) => b.impact - a.impact).slice(0, 6);
}
