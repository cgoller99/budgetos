"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Select,
  SkeletonGrid,
  StatCard,
} from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { AdminChart } from "./AdminChart";
import { ConfirmActionModal } from "./ConfirmActionModal";
import { scheduleAdminHashScroll } from "./adminHashScroll";
import type {
  AdminUserAction,
  AdminUserSummary,
  AdminFeedbackReport,
  AdminHealthCheck,
  AdminEventLogEntry,
  AdminOverviewMetrics,
  AdminAnalyticsMetrics,
  AdminRevenueMetrics,
  AdminPlaidMetrics,
} from "@/lib/admin/types";

type PendingAction = {
  userId: string;
  action: AdminUserAction;
  label: string;
};

function getActionConfirmCopy(action: AdminUserAction, label: string): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  if (action === "reset_finance") {
    return {
      title: "Factory reset finance data",
      description:
        "This permanently deletes all finance data for this user: Plaid bank connections, accounts, transactions, bills, goals, income plans, investments, and notifications. The login, profile, and subscription are kept. Onboarding resets to a fresh start. This cannot be undone.",
      confirmLabel: "Reset finance data",
    };
  }

  if (action === "delete_user") {
    return {
      title: "Delete user account",
      description:
        "This permanently deletes the user profile and auth account. All associated data is removed. This cannot be undone.",
      confirmLabel: "Delete user",
    };
  }

  return {
    title: `Confirm ${label}`,
    description: `This will ${label.toLowerCase()} the selected user account. This action may be irreversible.`,
    confirmLabel: label,
  };
}

type SectionKey =
  | "overview"
  | "revenue"
  | "plaid"
  | "analytics"
  | "health"
  | "logs"
  | "users"
  | "feedback";

function sectionLoadError(status: number): string {
  if (status === 503) {
    return "Admin backend is not configured (missing SUPABASE_SERVICE_ROLE_KEY).";
  }
  return "Failed to load this section.";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function healthColor(status: AdminHealthCheck["status"]): string {
  if (status === "green") return "bg-emerald-500";
  if (status === "yellow") return "bg-amber-400";
  return "bg-rose-500";
}

function Section({
  id,
  title,
  description,
  loadError,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  loadError?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {loadError ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {loadError}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [overview, setOverview] = useState<AdminOverviewMetrics | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenueMetrics | null>(null);
  const [plaid, setPlaid] = useState<AdminPlaidMetrics | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsMetrics | null>(null);
  const [health, setHealth] = useState<AdminHealthCheck[]>([]);
  const [logs, setLogs] = useState<AdminEventLogEntry[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedbackReport[]>([]);
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("all");
  const [feedbackType, setFeedbackType] = useState("all");
  const [search, setSearch] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSectionErrors({});

    const loadSection = async (
      key: SectionKey,
      url: string,
      apply: (payload: unknown) => void,
    ): Promise<void> => {
      try {
        const response = await fetch(url);

        if (response.status === 403) {
          throw new Error("You do not have admin access.");
        }

        if (!response.ok) {
          setSectionErrors((current) => ({
            ...current,
            [key]: sectionLoadError(response.status),
          }));
          return;
        }

        apply(await response.json());
      } catch (loadError) {
        if (loadError instanceof Error && loadError.message.includes("admin access")) {
          throw loadError;
        }

        setSectionErrors((current) => ({
          ...current,
          [key]: "Failed to load this section.",
        }));
      }
    };

    try {
      await Promise.all([
        loadSection("overview", "/api/admin/overview", (payload) =>
          setOverview(payload as AdminOverviewMetrics),
        ),
        loadSection("revenue", "/api/admin/revenue", (payload) =>
          setRevenue(payload as AdminRevenueMetrics),
        ),
        loadSection("plaid", "/api/admin/plaid", (payload) => setPlaid(payload as AdminPlaidMetrics)),
        loadSection("analytics", "/api/admin/analytics", (payload) =>
          setAnalytics(payload as AdminAnalyticsMetrics),
        ),
        loadSection("health", "/api/admin/health", (payload) => {
          const data = payload as { checks?: AdminHealthCheck[] };
          setHealth(data.checks ?? []);
        }),
        loadSection("logs", "/api/admin/logs", (payload) => {
          const data = payload as { logs?: AdminEventLogEntry[] };
          setLogs(data.logs ?? []);
        }),
        loadSection("users", "/api/admin/users", (payload) => {
          const data = payload as { users?: AdminUserSummary[] };
          setUsers(data.users ?? []);
        }),
        loadSection("feedback", "/api/admin/feedback", (payload) => {
          const data = payload as { reports?: AdminFeedbackReport[] };
          setFeedback(data.reports ?? []);
        }),
      ]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
      scheduleAdminHashScroll();
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const searchUsers = useCallback(async () => {
    const response = await fetch(`/api/admin/users?q=${encodeURIComponent(search.trim())}`);
    if (!response.ok) return;
    const payload = await response.json();
    setUsers(payload.users ?? []);
  }, [search]);

  const searchFeedback = useCallback(async () => {
    const params = new URLSearchParams();
    if (feedbackSearch.trim()) params.set("q", feedbackSearch.trim());
    if (feedbackStatus !== "all") params.set("status", feedbackStatus);
    if (feedbackType !== "all") params.set("type", feedbackType);

    const response = await fetch(`/api/admin/feedback?${params.toString()}`);
    if (!response.ok) return;
    const payload = await response.json();
    setFeedback(payload.reports ?? []);
  }, [feedbackSearch, feedbackStatus, feedbackType]);

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter((log) => log.eventType === logFilter);
  }, [logFilter, logs]);

  async function runUserAction() {
    if (!pendingAction) return;

    setActionPending(true);

    try {
      const response = await fetch(`/api/admin/users/${pendingAction.userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pendingAction.action }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Action failed.");
      }

      await searchUsers();
      setPendingAction(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setActionPending(false);
    }
  }

  async function updateFeedback(
    reportId: string,
    input: { status?: AdminFeedbackReport["status"]; priority?: AdminFeedbackReport["priority"] },
  ) {
    const response = await fetch(`/api/admin/feedback/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) return;

    setFeedback((current) =>
      current.map((report) =>
        report.id === reportId
          ? {
              ...report,
              status: input.status ?? report.status,
              priority: input.priority ?? report.priority,
            }
          : report,
      ),
    );
  }

  const confirmCopy = pendingAction
    ? getActionConfirmCopy(pendingAction.action, pendingAction.label)
    : null;

  if (loading) {
    return <SkeletonGrid count={4} className="max-w-5xl" />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-10 text-center">
        <p className="text-sm text-rose-300">{error}</p>
        <Button className="mt-4" size="md" onClick={() => void loadDashboard()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {Object.keys(sectionErrors).length > 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Some dashboard sections failed to load. Check server configuration and retry individual
          sections below.
        </div>
      ) : null}

      <Section
        id="overview"
        title="Dashboard overview"
        description="Platform health at a glance."
        loadError={sectionErrors.overview}
      >
        <MetricGrid>
          <StatCard label="Total Users" value={String(overview?.totalUsers ?? 0)} change="" mutedChange />
          <StatCard label="New Users Today" value={String(overview?.newUsersToday ?? 0)} change="" mutedChange />
          <StatCard label="Active Users (24h)" value={String(overview?.activeUsers24h ?? 0)} change="" mutedChange />
          <StatCard label="Active Users (7d)" value={String(overview?.activeUsers7d ?? 0)} change="" mutedChange />
          <StatCard label="Active Users (30d)" value={String(overview?.activeUsers30d ?? 0)} change="" mutedChange />
          <StatCard label="Total Households" value={String(overview?.totalHouseholds ?? 0)} change="" mutedChange />
          <StatCard label="Total Goals" value={String(overview?.totalGoals ?? 0)} change="" mutedChange />
          <StatCard label="Total Bills" value={String(overview?.totalBills ?? 0)} change="" mutedChange />
          <StatCard label="Total Accounts" value={String(overview?.totalAccounts ?? 0)} change="" mutedChange />
          <StatCard label="Total Income Plans" value={String(overview?.totalIncomePlans ?? 0)} change="" mutedChange />
          <StatCard label="Feedback Reports" value={String(overview?.totalFeedbackReports ?? 0)} change="" mutedChange />
          <StatCard label="Bug Reports" value={String(overview?.totalBugReports ?? 0)} change="" mutedChange />
        </MetricGrid>
      </Section>

      <Section
        id="revenue"
        title="Revenue"
        description="Subscription metrics from Stripe and Buxme profiles."
        loadError={sectionErrors.revenue}
      >
        <MetricGrid>
          <StatCard label="MRR" value={formatCurrency(revenue?.mrr ?? 0)} change={revenue?.available ? "Stripe live" : "Stripe unavailable"} mutedChange />
          <StatCard label="ARR" value={formatCurrency(revenue?.arr ?? 0)} change="" mutedChange />
          <StatCard label="Free Users" value={String(revenue?.freeUsers ?? 0)} change="" mutedChange />
          <StatCard label="Pro Users" value={String(revenue?.proUsers ?? 0)} change="" mutedChange />
          <StatCard label="Pro+ Users" value={String(revenue?.proPlusUsers ?? 0)} change="" mutedChange />
          <StatCard label="Churn Rate" value={`${revenue?.churnRate ?? 0}%`} change="Last 30 days" mutedChange positive={false} />
          <StatCard label="New Subscriptions" value={String(revenue?.newSubscriptions ?? 0)} change="Last 30 days" mutedChange />
          <StatCard label="Cancellations" value={String(revenue?.cancellations ?? 0)} change="Last 30 days" mutedChange positive={false} />
          <StatCard label="Failed Payments" value={String(revenue?.failedPayments ?? 0)} change="Open invoices" mutedChange positive={false} />
        </MetricGrid>
      </Section>

      {plaid?.available || sectionErrors.plaid ? (
        <Section
          id="plaid"
          title="Plaid"
          description="Bank sync connection health."
          loadError={sectionErrors.plaid}
        >
          <MetricGrid>
            <StatCard label="Connected Institutions" value={String(plaid?.connectedInstitutions ?? 0)} change="" mutedChange />
            <StatCard label="Connected Accounts" value={String(plaid?.connectedAccounts ?? 0)} change="" mutedChange />
            <StatCard label="Sync Success Rate" value={`${plaid?.syncSuccessRate ?? 0}%`} change="" mutedChange />
            <StatCard label="Failed Syncs" value={String(plaid?.failedSyncs ?? 0)} change="" mutedChange positive={false} />
            <StatCard label="Last Sync" value={formatDate(plaid?.lastSync)} change="" mutedChange />
            <StatCard
              label="Average Sync Time"
              value={
                plaid?.averageSyncTimeMs != null ? `${plaid.averageSyncTimeMs} ms` : "—"
              }
              change=""
              mutedChange
            />
          </MetricGrid>
        </Section>
      ) : null}

      <Section
        id="users"
        title="User management"
        description="Search users and perform privileged account actions."
        loadError={sectionErrors.users}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, name, or user ID"
            className="flex-1"
          />
          <Button size="md" onClick={() => void searchUsers()}>
            Search
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--surface-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Subscription</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--surface-border)]/70">
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium text-[var(--foreground)]">{user.fullName ?? "Unnamed user"}</p>
                    <p className="text-xs text-[var(--text-muted)]">{user.email ?? user.id}</p>
                    {user.isDisabled ? <Badge variant="warning">Disabled</Badge> : null}
                    {user.adminFounderGranted || user.isEnvFounder ? (
                      <Badge variant="accent">Founder</Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top capitalize text-[var(--text-secondary)]">
                    {user.subscriptionPlan} · {user.subscriptionStatus}
                  </td>
                  <td className="px-4 py-4 align-top text-[var(--text-muted)]">{formatDate(user.joinedAt)}</td>
                  <td className="px-4 py-4 align-top text-[var(--text-muted)]">{formatDate(user.lastSignInAt)}</td>
                  <td className="px-4 py-4 align-top text-xs text-[var(--text-muted)]">
                    Goals {user.goalCount} · Accounts {user.connectedAccountCount} · Feedback {user.feedbackCount}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      {[
                        ["grant_founder", "Founder"],
                        ["grant_pro", "Pro"],
                        ["grant_pro_plus", "Pro+"],
                        ["remove_subscription", "Remove"],
                        user.isDisabled ? ["enable_user", "Enable"] : ["disable_user", "Disable"],
                        ["reset_finance", "Reset"],
                        ["delete_user", "Delete"],
                      ].map(([action, label]) => (
                        <Button
                          key={action}
                          size="sm"
                          variant={
                            action === "delete_user" || action === "reset_finance"
                              ? "secondary"
                              : "ghost"
                          }
                          onClick={() =>
                            setPendingAction({
                              userId: user.id,
                              action: action as AdminUserAction,
                              label,
                            })
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="feedback"
        title="Feedback queue"
        description="Bug reports, feature requests, and product feedback submitted by users."
        loadError={sectionErrors.feedback}
      >
        <div className="flex flex-col gap-3 lg:flex-row">
          <Input
            value={feedbackSearch}
            onChange={(event) => setFeedbackSearch(event.target.value)}
            placeholder="Search message, email, or page"
            className="flex-1"
          />
          <Select
            value={feedbackStatus}
            onChange={(event) => setFeedbackStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="investigating">Investigating</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </Select>
          <Select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)}>
            <option value="all">All types</option>
            <option value="feedback">Feedback</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Feature request</option>
          </Select>
          <Button size="md" onClick={() => void searchFeedback()}>
            Search
          </Button>
        </div>
        <div className="space-y-4">
          {feedback.length === 0 ? (
            <Card padding="lg">
              <CardContent>
                <p className="text-sm text-[var(--text-muted)]">No feedback reports yet.</p>
              </CardContent>
            </Card>
          ) : (
            feedback.map((report) => (
              <Card key={report.id} padding="lg">
                <CardHeader
                  title={`${
                    report.reportType === "bug"
                      ? "Bug"
                      : report.reportType === "feature_request"
                        ? "Feature request"
                        : "Feedback"
                  } · ${report.userEmail ?? "Anonymous"}`}
                  action={<Badge variant="default">{report.priority}</Badge>}
                />
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{report.message}</p>
                  <div className="grid gap-3 text-xs text-[var(--text-muted)] sm:grid-cols-2 lg:grid-cols-4">
                    <p>Category: {report.category ?? "—"}</p>
                    <p>Browser: {report.browser ?? "—"}</p>
                    <p>Device: {report.device ?? "—"}</p>
                    <p>Page: {report.pagePath ?? "—"}</p>
                    <p>Version: {report.appVersion ?? "—"}</p>
                    <p>Date: {formatDate(report.createdAt)}</p>
                    <p>Screenshot: {report.screenshotUrl ? "Attached" : "—"}</p>
                    <p>Recording: {report.recordingUrl ? "Attached" : "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select
                      value={report.status}
                      onChange={(event) =>
                        void updateFeedback(report.id, {
                          status: event.target.value as AdminFeedbackReport["status"],
                        })
                      }
                    >
                      <option value="new">New</option>
                      <option value="investigating">Investigating</option>
                      <option value="planned">Planned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="closed">Closed</option>
                    </Select>
                    <Select
                      value={report.priority}
                      onChange={(event) =>
                        void updateFeedback(report.id, {
                          priority: event.target.value as AdminFeedbackReport["priority"],
                        })
                      }
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </Section>

      <Section
        id="analytics"
        title="Analytics"
        description="30-day platform trends."
        loadError={sectionErrors.analytics}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminChart title="Daily Signups" points={analytics?.dailySignups ?? []} />
          <AdminChart title="Daily Active Users" points={analytics?.dailyActiveUsers ?? []} />
          <AdminChart title="Subscription Growth" points={analytics?.subscriptionGrowth ?? []} />
          <AdminChart title="Revenue" points={analytics?.revenue ?? []} valuePrefix="$" />
          <AdminChart title="Goal Creation" points={analytics?.goalCreation ?? []} />
          <AdminChart title="Bill Creation" points={analytics?.billCreation ?? []} />
          <AdminChart title="Household Growth" points={analytics?.householdGrowth ?? []} className="lg:col-span-2" />
        </div>
      </Section>

      <Section id="health" title="System health" loadError={sectionErrors.health}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {health.map((check) => (
            <Card key={check.id} padding="lg">
              <CardContent className="flex items-start gap-3">
                <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", healthColor(check.status))} />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{check.label}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{check.detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="logs"
        title="Logs"
        description="Recent platform events."
        loadError={sectionErrors.logs}
      >
        <div className="mb-4 max-w-xs">
          <Select value={logFilter} onChange={(event) => setLogFilter(event.target.value)}>
            <option value="all">All events</option>
            <option value="error">Errors</option>
            <option value="stripe">Stripe events</option>
            <option value="plaid">Plaid events</option>
            <option value="auth">Authentication events</option>
            <option value="api_failure">API failures</option>
          </Select>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[var(--surface-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--surface-border)]/70">
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{log.eventType}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{log.message}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <ConfirmActionModal
        isOpen={Boolean(pendingAction)}
        title={confirmCopy?.title ?? "Confirm action"}
        description={confirmCopy?.description ?? "This action may be irreversible."}
        confirmLabel={confirmCopy?.confirmLabel ?? "Confirm"}
        isPending={actionPending}
        onClose={() => setPendingAction(null)}
        onConfirm={() => void runUserAction()}
      />
    </div>
  );
}
