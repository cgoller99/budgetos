export type AdminUserAction =
  | "grant_founder"
  | "grant_pro"
  | "grant_pro_plus"
  | "remove_subscription"
  | "disable_user"
  | "enable_user"
  | "delete_user";

export type AdminUserSummary = {
  id: string;
  email: string | null;
  fullName: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  joinedAt: string;
  lastActiveAt: string | null;
  isDisabled: boolean;
  adminFounderGranted: boolean;
  isEnvFounder: boolean;
  householdId: string | null;
  goalCount: number;
  connectedAccountCount: number;
  feedbackCount: number;
  lastSignInAt: string | null;
};

export type FeedbackStatus =
  | "new"
  | "investigating"
  | "planned"
  | "in_progress"
  | "completed"
  | "closed";
export type FeedbackPriority = "low" | "normal" | "high" | "urgent";
export type FeedbackReportType = "feedback" | "bug" | "feature_request";

export type AdminFeedbackReport = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  reportType: FeedbackReportType;
  message: string;
  category: string | null;
  screenshotUrl: string | null;
  recordingUrl: string | null;
  browser: string | null;
  device: string | null;
  appVersion: string | null;
  pagePath: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  createdAt: string;
  updatedAt: string;
};

export type HealthStatus = "green" | "yellow" | "red";

export type AdminHealthCheck = {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
};

export type AdminEventLogEntry = {
  id: string;
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
  userId: string | null;
  createdAt: string;
};

export type AdminOverviewMetrics = {
  totalUsers: number;
  newUsersToday: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalHouseholds: number;
  totalGoals: number;
  totalBills: number;
  totalAccounts: number;
  totalIncomePlans: number;
  totalFeedbackReports: number;
  totalBugReports: number;
};

export type AdminAnalyticsPoint = {
  date: string;
  value: number;
};

export type AdminAnalyticsMetrics = {
  dailySignups: AdminAnalyticsPoint[];
  dailyActiveUsers: AdminAnalyticsPoint[];
  subscriptionGrowth: AdminAnalyticsPoint[];
  revenue: AdminAnalyticsPoint[];
  goalCreation: AdminAnalyticsPoint[];
  billCreation: AdminAnalyticsPoint[];
  householdGrowth: AdminAnalyticsPoint[];
};

export type AdminRevenueMetrics = {
  available: boolean;
  mrr: number;
  arr: number;
  freeUsers: number;
  proUsers: number;
  proPlusUsers: number;
  churnRate: number;
  newSubscriptions: number;
  cancellations: number;
  failedPayments: number;
};

export type AdminPlaidMetrics = {
  available: boolean;
  connectedInstitutions: number;
  connectedAccounts: number;
  syncSuccessRate: number;
  failedSyncs: number;
  lastSync: string | null;
  averageSyncTimeMs: number | null;
};
