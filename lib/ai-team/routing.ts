export type RoutedSpecialistId =
  | "analytics"
  | "engineering"
  | "qa"
  | "product"
  | "growth"
  | "customer";

const ROLE_PATTERNS: Record<
  Exclude<RoutedSpecialistId, "analytics">,
  RegExp[]
> = {
  engineering: [
    /bug|fix|build|code|performance|plaid|stripe|auth|ios|api|database|deploy|error|crash|security/i,
  ],
  qa: [
    /launch|release|bug|fix|flow|checkout|plaid|ios|signup|login|onboarding|regression|test/i,
  ],
  product: [
    /product|ux|ui|onboarding|feature|screen|flow|experience|navigation|paywall|dashboard/i,
  ],
  growth: [
    /growth|marketing|tiktok|\bads?\b|acquisition|conversion|pricing|campaign|landing page|launch message|signup/i,
  ],
  customer: [
    /customer|support|feedback|customer review|app review|complaint|help|ticket|support response|retention/i,
  ],
};

export function selectAiTeamSpecialists(goal: string): RoutedSpecialistId[] {
  const ranked = Object.entries(ROLE_PATTERNS)
    .map(([id, patterns]) => ({
      id: id as Exclude<RoutedSpecialistId, "analytics">,
      score: patterns.reduce(
        (total, pattern) => total + (pattern.test(goal) ? 1 : 0),
        0,
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return ["analytics", "product"];
  }

  return ["analytics", ...ranked.slice(0, 3).map((candidate) => candidate.id)];
}
