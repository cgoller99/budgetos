import type {
  AiTeamIntelligenceReport,
  AiTeamMission,
  AiTeamMissionStatus,
  AiTeamRun,
} from "@/lib/ai-team/types";

const NO_CHANGES = "No changes were made.";

function uniqueText(values: Array<string | null | undefined>, maximum = 20) {
  return [
    ...new Set(
      values
        .map((value) => value?.replace(/\s+/g, " ").trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].slice(0, maximum);
}

export function buildAiTeamIntelligenceReport(
  mission: AiTeamMission,
  run: AiTeamRun | null,
  status: AiTeamMissionStatus,
  elapsedTimeMs: number,
): AiTeamIntelligenceReport {
  const failedEvents = mission.events.filter(
    (event) => event.status === "failed" || event.status === "stopped",
  );
  const failedChecks = mission.verifications.filter(
    (verification) => verification.status === "failed",
  );
  const warnings = mission.events
    .filter((event) => event.status === "warning")
    .map((event) => event.detail ?? event.summary);
  const actionFindings = mission.events
    .filter((event) => event.eventType === "finding")
    .map((event) => event.detail ?? event.summary);

  if (run?.source === "fallback") {
    warnings.unshift(
      "AI model runtime was unavailable or did not complete; deterministic fallback planning was used.",
    );
  }
  if (mission.autonomyLevel === "act" || mission.autonomyLevel === "autopilot") {
    warnings.push(
      mission.context.actionBridge === true
        ? "Only the registered internal Buxme action bridge was available; unrestricted external/local execution remains disconnected."
        : "No external/local action executor connected; the selected autonomy policy did not execute actions.",
    );
  }

  const couldNotComplete = uniqueText([
    ...failedEvents.map((event) => event.detail ?? event.summary),
    ...failedChecks.map((verification) => verification.summary),
  ]);
  if (
    couldNotComplete.length === 0 &&
    (status === "failed" || status === "partial" || status === "stopped")
  ) {
    couldNotComplete.push("The mission did not complete all attempted work.");
  }

  return {
    command: mission.command,
    status,
    elapsedTimeMs: Math.max(0, Math.round(elapsedTimeMs)),
    agentsUsed: uniqueText(
      mission.events.map((event) => event.agentId),
    ),
    whatWasRequested: [mission.command],
    whatTheTeamDid: uniqueText(
      mission.events
        .filter(
          (event) =>
            event.status === "completed" &&
            !["received", "verification"].includes(event.eventType),
        )
        .map((event) => event.summary),
    ),
    whatItFound: uniqueText([
      run?.summary,
      ...(run?.snapshot.observations ?? []),
      ...actionFindings,
    ]),
    whatChanged:
      mission.changes.length === 0
        ? [NO_CHANGES]
        : uniqueText(mission.changes.map((change) => change.summary)),
    filesDataActionsAffected: uniqueText(
      mission.changes.map(
        (change) =>
          `${change.targetType}: ${change.targetRef} (${change.action})`,
      ),
    ),
    importantFindings: uniqueText([
      ...actionFindings,
      ...(run?.snapshot.observations ?? []),
      ...(run?.tasks
        .flatMap((task) => task.evidence)
        .filter((evidence) => !evidence.startsWith("Unavailable sources:")) ??
        []),
    ]),
    warnings: uniqueText(warnings),
    whatCouldNotBeCompleted: couldNotComplete,
    verificationResults: mission.verifications.map((verification) => ({
      checkType: verification.checkType,
      status: verification.status,
      summary: verification.summary,
    })),
    recommendedNextActions: uniqueText(
      run?.tasks.map((task) => task.title) ?? [],
    ),
  };
}

export { NO_CHANGES };
