export type BetaUserStatus = "pending" | "approved" | "rejected";

export type BetaWaitlistEntry = {
  id: string;
  email: string;
  fullName: string | null;
  status: BetaUserStatus;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BetaSettings = {
  inviteOnly: boolean;
  maxBetaUsers: number | null;
  waitlistEnabled: boolean;
  updatedAt: string;
};

export type BetaDashboardMetrics = {
  pendingBetaUsers: number;
  approvedBetaUsers: number;
  rejectedBetaUsers: number;
  waitlistPending: number;
  feedbackStats: {
    total: number;
    bugs: number;
    featureRequests: number;
    open: number;
  };
  featureLeaderboard: Array<{ message: string; count: number }>;
  dailySignups: Array<{ date: string; value: number }>;
  dailyActiveUsers: Array<{ date: string; value: number }>;
  topPages: Array<{ page: string; count: number }>;
  plaidConnectionRate: number;
  subscriptionConversion: number;
};
