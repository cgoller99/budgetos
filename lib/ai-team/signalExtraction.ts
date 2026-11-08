import type { AiTeamSnapshot } from "./types";
import type { AutonomousSignal } from "./autonomousPriorities";
/** Converts existing admin metrics into actionable, evidence-backed proposals. */
export function signalsFromAiTeamSnapshot(snapshot: AiTeamSnapshot): AutonomousSignal[] {
  const signals: AutonomousSignal[] = [];
  for (const check of snapshot.health) {
    if (check.status === "green") continue;
    signals.push({ id: `health:${check.id}`, title: `Investigate ${check.label}`, source: "reliability",
      severity: check.status === "red" ? 5 : 3, affectedUsers: 0, confidence: 0.9,
      evidence: [check.detail || `Health check ${check.id} is ${check.status}`],
      proposedAction: `Inspect the ${check.label} health check and prepare a verified remediation plan.` });
  }
  if (snapshot.plaid?.available && snapshot.plaid.failedSyncs > 0) {
    signals.push({ id: "plaid:failed-syncs", title: "Investigate bank sync failures", source: "reliability",
      severity: snapshot.plaid.syncSuccessRate < 90 ? 5 : 3,
      affectedUsers: 0, confidence: 0.95,
      evidence: [`${snapshot.plaid.failedSyncs} failed syncs; ${snapshot.plaid.syncSuccessRate}% sync success rate`],
      proposedAction: "Inspect Plaid sync logs and prepare a targeted fix." });
  }
  if (snapshot.overview && snapshot.overview.totalBugReports > 0) {
    signals.push({ id: "customer:bug-reports", title: "Triage reported bugs", source: "customer",
      severity: 3, affectedUsers: 0, confidence: 0.8,
      evidence: [`${snapshot.overview.totalBugReports} recorded bug reports (historical total, not necessarily unresolved)`],
      proposedAction: "Review recent bug reports, distinguish resolved from unresolved, and rank reproducible issues." });
  }
  if (snapshot.revenue?.available && snapshot.revenue.failedPayments > 0) {
    signals.push({ id: "revenue:failed-payments", title: "Review failed payments", source: "revenue",
      severity: 3, affectedUsers: 0, confidence: 0.9,
      evidence: [`${snapshot.revenue.failedPayments} failed-payment invoices`],
      proposedAction: "Investigate billing failure causes without modifying charges or contacting customers." });
  }
  return signals;
}
