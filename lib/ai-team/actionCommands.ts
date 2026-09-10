import type {
  AiTeamActionDefinition,
  AiTeamActionKey,
} from "@/lib/ai-team/types";

export const AI_TEAM_ACTIONS: AiTeamActionDefinition[] = [
  {
    key: "intelligence.refresh",
    label: "Refresh intelligence",
    description:
      "Refreshes Buxme operating, product, revenue, and customer intelligence without changing customer data.",
    riskClass: "read",
    mutates: false,
    minimumAutonomy: "observe",
    exampleCommand: "refresh intelligence",
  },
  {
    key: "founder_brief.generate",
    label: "Generate founder brief",
    description:
      "Regenerates and persists today's private founder brief from current Buxme evidence.",
    riskClass: "normal_write",
    mutates: true,
    minimumAutonomy: "act",
    exampleCommand: "generate founder brief",
  },
];
const ACTION_PATTERNS: Array<{
  key: AiTeamActionKey;
  pattern: RegExp;
}> = [
  {
    key: "intelligence.refresh",
    pattern:
      /^(?:please\s+)?(?:refresh|sync|update)\s+(?:the\s+)?(?:buxme\s+)?(?:intelligence|data|snapshot)[.!]?$/i,
  },
  {
    key: "founder_brief.generate",
    pattern:
      /^(?:please\s+)?(?:generate|refresh|update|regenerate)\s+(?:the\s+)?founder\s+brief[.!]?$/i,
  },
];

export function getAiTeamActionDefinition(
  key: AiTeamActionKey,
): AiTeamActionDefinition {
  const definition = AI_TEAM_ACTIONS.find((action) => action.key === key);
  if (!definition) throw new Error("Unknown AI Team action.");
  return definition;
}
export function detectAiTeamActionCommand(
  command: string,
): AiTeamActionKey | null {
  const normalized = command.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return (
    ACTION_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.key ?? null
  );
}

export function autonomyAllowsAiTeamAction(
  autonomy: "observe" | "assist" | "act" | "autopilot",
  action: AiTeamActionDefinition,
): boolean {
  const rank = { observe: 0, assist: 1, act: 2, autopilot: 3 } as const;
  return rank[autonomy] >= rank[action.minimumAutonomy];
}
