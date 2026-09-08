import type {
  AdminAnalyticsMetrics,
  AdminHealthCheck,
  AdminOverviewMetrics,
  AdminPlaidMetrics,
  AdminRevenueMetrics,
} from "@/lib/admin/types";

export type AiTeamAgentId =
  | "chief_of_staff"
  | "engineering"
  | "qa"
  | "analytics"
  | "product"
  | "growth"
  | "customer"
  | "critic";

export type AiTeamTaskStatus =
  | "queued"
  | "running"
  | "needs_approval"
  | "completed"
  | "failed";

export type AiTeamAgent = {
  id: AiTeamAgentId;
  name: string;
  mission: string;
  permissions: string[];
  guardrails: string[];
};
export type AiTeamSnapshot = {
  generatedAt: string;
  overview: AdminOverviewMetrics | null;
  revenue: AdminRevenueMetrics | null;
  plaid: AdminPlaidMetrics | null;
  analytics: AdminAnalyticsMetrics | null;
  health: AdminHealthCheck[];
  observations: string[];
  unavailableSources: string[];
};

export type AiTeamTask = {
  id: string;
  owner: AiTeamAgentId;
  title: string;
  objective: string;
  status: AiTeamTaskStatus;
  evidence: string[];
  requiresApproval: boolean;
  approvalReason?: string;
};

export type AiTeamPlan = {
  id: string;
  goal: string;
  createdAt: string;
  summary: string;
  source: "ai" | "fallback";
  model?: string;
  observations: string[];
  tasks: AiTeamTask[];
  guardrails: string[];
};

export type AiTeamRun = {
  id: string;
  createdBy: string | null;
  goal: string;
  source: AiTeamPlan["source"];
  model: string | null;
  summary: string;
  snapshot: AiTeamSnapshot;
  createdAt: string;
  tasks: AiTeamTask[];
};

export type AiTeamRuntimeInfo = {
  mode: "ai" | "fallback";
  specialistModel: string;
  orchestratorModel: string;
};
