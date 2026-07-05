export type FeedbackReportType = "feedback" | "bug" | "feature_request";

export type FeedbackStatus =
  | "new"
  | "investigating"
  | "planned"
  | "in_progress"
  | "completed"
  | "closed";

export type FeedbackPriority = "low" | "normal" | "high" | "urgent";

export type FeedbackCategory =
  | "general"
  | "ui"
  | "performance"
  | "billing"
  | "bank_sync"
  | "data"
  | "other";

export type FeedbackReport = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  reportType: FeedbackReportType;
  message: string;
  category: FeedbackCategory | null;
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

export type SubmitFeedbackInput = {
  reportType: FeedbackReportType;
  message: string;
  category?: FeedbackCategory;
  priority?: FeedbackPriority;
  screenshotUrl?: string;
  recordingUrl?: string;
  pagePath?: string;
  browser?: string;
  device?: string;
  appVersion?: string;
};

export const FEEDBACK_STATUSES: FeedbackStatus[] = [
  "new",
  "investigating",
  "planned",
  "in_progress",
  "completed",
  "closed",
];

export const FEEDBACK_CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "general", label: "General" },
  { value: "ui", label: "UI / UX" },
  { value: "performance", label: "Performance" },
  { value: "billing", label: "Billing" },
  { value: "bank_sync", label: "Bank sync" },
  { value: "data", label: "Data accuracy" },
  { value: "other", label: "Other" },
];

export const FEEDBACK_TYPES: Array<{ value: FeedbackReportType; label: string }> = [
  { value: "feedback", label: "General Feedback" },
  { value: "bug", label: "Bug Report" },
  { value: "feature_request", label: "Feature Request" },
];
