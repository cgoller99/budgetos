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

export type AiTeamActivityStatus =
  | "pending"
  | "running"
  | "completed"
  | "warning"
  | "failed";

export type AiTeamActivityEvent = {
  id: string;
  operationId: string;
  createdBy: string;
  runId: string | null;
  agentId: AiTeamAgentId | null;
  phase: string;
  status: AiTeamActivityStatus;
  label: string;
  detail: string | null;
  ordinal: number;
  createdAt: string;
};

export type AiTeamProgressEvent = {
  agentId?: AiTeamAgentId;
  phase: string;
  status: AiTeamActivityStatus;
  label: string;
  detail?: string;
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

export type AiTeamEvidenceState = "observed" | "derived" | "missing";

export type AiTeamProductSignal = {
  id: string;
  label: string;
  state: AiTeamEvidenceState;
  value: number | string | null;
  detail: string;
  source: string;
  numerator?: number;
  denominator?: number;
  rate?: number;
};

export type AiTeamProductAnalytics = {
  generatedAt: string;
  posthog: {
    status: "connected" | "missing_config" | "error";
    detail: string;
  };
  signals: AiTeamProductSignal[];
  funnels: Array<{
    id: string;
    label: string;
    stages: Array<{ label: string; count: number | null; source: string }>;
    conversionRate: number | null;
  }>;
  missingEvidence: string[];
};

export type AiTeamRevenueProjection = {
  targetMrr: number;
  blendedCustomersNeeded: number | null;
  proCustomersNeeded: number;
  proPlusCustomersNeeded: number;
};

export type AiTeamRevenueIntelligence = AdminRevenueMetrics & {
  generatedAt: string;
  paidUsers: number;
  arpu: number | null;
  freeToPaidRatio: number | null;
  proMonthlyPrice: number;
  proPlusMonthlyPrice: number;
  projections: AiTeamRevenueProjection[];
  notes: string[];
};

export type AiTeamCustomerVoice = {
  generatedAt: string;
  total: number;
  counts: {
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
  themes: Array<{
    id: string;
    label: string;
    count: number;
    reportIds: string[];
  }>;
  recentSignals: Array<{
    id: string;
    type: string;
    priority: string;
    snippet: string;
    pagePath: string | null;
    createdAt: string;
  }>;
  frictionSurfaces: {
    paths: Array<{ value: string; count: number }>;
    devices: Array<{ value: string; count: number }>;
    appVersions: Array<{ value: string; count: number }>;
  };
  investigationPrompts: string[];
};

export type AiTeamExecutionCandidate = {
  task: AiTeamTask;
  run: {
    id: string;
    goal: string;
    summary: string;
    createdAt: string;
  };
  decision: AiTeamApprovalDecision;
};

export type AiTeamExecutionPacket = {
  id: string;
  taskId: string;
  runId: string;
  approvalDecisionId: string;
  createdBy: string;
  status: "staged" | "claimed" | "completed" | "failed";
  task: Record<string, unknown>;
  run: Record<string, unknown>;
  approval: Record<string, unknown>;
  evidence: string[];
  proposedBranchName: string;
  implementationBrief: string;
  validationChecklist: string[];
  rollbackNotes: string;
  requiresExternalOperator: true;
  createdAt: string;
  updatedAt: string;
};

export type AiTeamFounderBriefSections = {
  whatChanged: string[];
  revenue: string[];
  product: string[];
  customers: string[];
  reliability: string[];
  decisionsWaiting: string[];
  executionReadyWork: string[];
  topPriorities: string[];
  risks: string[];
  missingEvidence: string[];
};

export type AiTeamFounderBrief = {
  id: string;
  briefDate: string;
  generatedBy: string;
  source: "deterministic" | "ai";
  snapshot: Record<string, unknown>;
  sections: AiTeamFounderBriefSections;
  createdAt: string;
  updatedAt: string;
};

export type AiTeamRuntimeInfo = {
  mode: "ai" | "fallback";
  specialistModel: string;
  orchestratorModel: string;
};

export type AiTeamMissionStatus =
  | "received"
  | "planning"
  | "running"
  | "waiting_approval"
  | "verifying"
  | "completed"
  | "partial"
  | "failed"
  | "stopped";

export type AiTeamAutonomyLevel =
  | "observe"
  | "assist"
  | "act"
  | "autopilot";

export type AiTeamMissionEventStatus =
  | AiTeamActivityStatus
  | "stopped";

export type AiTeamVerificationStatus =
  | "passed"
  | "failed"
  | "not_applicable";

export type AiTeamMissionEvent = {
  id: string;
  missionId: string;
  createdBy: string;
  phase: string;
  eventType: string;
  agentId: AiTeamAgentId | null;
  toolName: string | null;
  status: AiTeamMissionEventStatus;
  summary: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  ordinal: number;
  occurredAt: string;
  createdAt: string;
};

export type AiTeamMissionChange = {
  id: string;
  missionId: string;
  createdBy: string;
  targetType: string;
  targetRef: string;
  action: string;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  summary: string;
  verified: boolean;
  createdAt: string;
};

export type AiTeamMissionVerification = {
  id: string;
  missionId: string;
  createdBy: string;
  checkType: string;
  status: AiTeamVerificationStatus;
  summary: string;
  evidence: Record<string, unknown>;
  createdAt: string;
};

export type AiTeamIntelligenceReport = {
  command: string;
  status: AiTeamMissionStatus;
  elapsedTimeMs: number;
  agentsUsed: string[];
  whatWasRequested: string[];
  whatTheTeamDid: string[];
  whatItFound: string[];
  whatChanged: string[];
  filesDataActionsAffected: string[];
  importantFindings: string[];
  warnings: string[];
  whatCouldNotBeCompleted: string[];
  verificationResults: Array<{
    checkType: string;
    status: AiTeamVerificationStatus;
    summary: string;
  }>;
  recommendedNextActions: string[];
};

export type AiTeamMission = {
  id: string;
  createdBy: string;
  runId: string | null;
  operationId: string;
  command: string;
  status: AiTeamMissionStatus;
  autonomyLevel: AiTeamAutonomyLevel;
  startedAt: string | null;
  completedAt: string | null;
  stopRequestedAt: string | null;
  elapsedMs: number | null;
  verified: boolean;
  finalReport: AiTeamIntelligenceReport | null;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  events: AiTeamMissionEvent[];
  changes: AiTeamMissionChange[];
  verifications: AiTeamMissionVerification[];
};

export type AiTeamScreenAnalysis = {
  analyzedAt: string;
  model: string;
  summary: string;
  surface: string | null;
  observations: string[];
  interactiveElements: Array<{
    label: string;
    kind: "button" | "link" | "input" | "menu" | "dialog" | "other";
    location: string;
    confidence: "low" | "medium" | "high";
  }>;
  warnings: string[];
  suggestedNextActions: string[];
  sensitiveContentDetected: boolean;
};

export type AiTeamToolRiskClass =
  | "read"
  | "normal_write"
  | "sensitive_write"
  | "destructive"
  | "external"
  | "financial"
  | "security";

export type AiTeamToolRecord = {
  id: string;
  label: string;
  description: string;
  riskClass: AiTeamToolRiskClass;
  connected: boolean;
  available: boolean;
  approvalRequired: boolean;
};

export type AiTeamActionRecord = {
  id: string;
  toolId: string;
  riskClass: AiTeamToolRiskClass;
  status: "planned" | "staged" | "blocked" | "completed" | "failed";
  summary: string;
  targetRef: string | null;
};
