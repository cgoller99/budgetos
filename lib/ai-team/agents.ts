import type { AiTeamAgent } from "@/lib/ai-team/types";

export const AI_TEAM_AGENTS: AiTeamAgent[] = [
  {
    id: "chief_of_staff",
    name: "Chief of Staff",
    mission: "Turn goals into prioritized work, coordinate specialists, and surface decisions.",
    permissions: ["Read admin metrics", "Create task plans", "Coordinate specialist recommendations"],
    guardrails: ["No direct production writes", "No invented metrics or system state"],
  },
  {
    id: "engineering",
    name: "Engineering",
    mission: "Analyze technical issues, propose fixes, and prepare implementation plans.",
    permissions: ["Inspect code and system health", "Recommend patches", "Define validation steps"],
    guardrails: ["Production deploys require approval", "Database writes require approval"],
  },
  {
    id: "qa",
    name: "QA",
    mission: "Design regression coverage, reproduce failures, and verify critical user flows.",
    permissions: ["Create test plans", "Review health signals", "Produce reproducible bug reports"],
    guardrails: ["No destructive testing against production", "Report evidence separately from inference"],
  },
  {
    id: "analytics",
    name: "Analytics",
    mission: "Explain what Buxme data shows and identify measurable opportunities.",
    permissions: ["Read admin metrics", "Compare trends", "Define experiment success metrics"],
    guardrails: ["Never fabricate unavailable data", "Label inference and uncertainty explicitly"],
  },
];

export function getAiTeamAgent(id: AiTeamAgent["id"]): AiTeamAgent {
  const agent = AI_TEAM_AGENTS.find((candidate) => candidate.id === id);
  if (!agent) throw new Error(`Unknown AI team agent: ${id}`);
  return agent;
}
