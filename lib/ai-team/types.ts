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
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type AiTeamAgent = {
  id: AiTeamAgentId;
  name: string;
  roleClass: "orchestrator" | "specialist" | "reviewer";
  mission: string;
  permissions: string[];
  guardrails: string[];
  routeKeywords: string[];
  capabilities: string[];
  costAwareness: "core" | "default" | "conditional";
};

export type AiTeamRuntimeMetadata = {
  selectedSpecialists: AiTeamAgentId[];
  modelCallCount?: number;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  criticSummary?: string;
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
  runtimeMetadata?: AiTeamRuntimeMetadata;
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
  runtimeMetadata: AiTeamRuntimeMetadata | null;
  createdAt: string;
  tasks: AiTeamTask[];
};

export type AiTeamApprovalDecision = {
  id: string;
  taskId: string;
  runId: string;
  actorId: string;
  actorEmail: string | null;
  decision: "approved" | "rejected";
  note: string | null;
  createdAt: string;
};

export type AiTeamPlaybook = {
  id: string;
  createdBy: string;
  title: string;
  description: string;
  category: string;
  goalTemplate: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AiTeamPlanningUsage = {
  used: number;
  limit: number;
};

export type AiTeamRuntimeInfo = {
  mode: "ai" | "fallback";
  specialistModel: string;
  orchestratorModel: string;
};
