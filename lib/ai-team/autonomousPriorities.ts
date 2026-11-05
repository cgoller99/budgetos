/** Deterministic, evidence-based prioritization for unattended Buxme missions.
 * This module selects proposals only; it never authorizes execution.
 */
export type AutonomousSignal = {
  id: string;
  title: string;
  source: "security" | "reliability" | "customer" | "revenue" | "growth" | "product";
  severity: 1 | 2 | 3 | 4 | 5;
  affectedUsers: number;
  confidence: number;
  evidence: string[];
  proposedAction: string;
  requiresExternalAction?: boolean;
};
export type AutonomousPriority = AutonomousSignal & {
  score: number;
  execution: "proposal_only" | "review_required";
};
const weights: Record<AutonomousSignal["source"], number> = {
  security: 35, reliability: 30, customer: 22,
  revenue: 20, product: 12, growth: 8,
};
export function prioritizeAutonomousSignals(signals: AutonomousSignal[]): AutonomousPriority[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (!signal.id.trim() || seen.has(signal.id) || !signal.title.trim() ||
        !signal.proposedAction.trim() || signal.evidence.length === 0 ||
        !Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 1 ||
        !Number.isFinite(signal.affectedUsers) || signal.affectedUsers < 0 ||
        !Number.isInteger(signal.severity) || signal.severity < 1 || signal.severity > 5 ||
        !weights[signal.source]) return false;
    seen.add(signal.id);
    return true;
  }).map((signal) => ({
    ...signal,
    score: Math.round((weights[signal.source] + signal.severity * 12 +
      Math.min(25, Math.log10(signal.affectedUsers + 1) * 10)) * signal.confidence),
    execution: signal.requiresExternalAction ? "review_required" as const : "proposal_only" as const,
  })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
