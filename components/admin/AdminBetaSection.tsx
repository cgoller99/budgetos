"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader, Input, StatCard } from "@/components/ui";
import { AdminChart } from "@/components/admin/AdminChart";
import { scheduleAdminHashScroll } from "@/components/admin/adminHashScroll";
import type { BetaDashboardMetrics, BetaSettings, BetaUserStatus, BetaWaitlistEntry } from "@/lib/beta/types";

type BetaProfileRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  betaStatus: BetaUserStatus;
  createdAt: string;
};

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminBetaSection() {
  const [metrics, setMetrics] = useState<BetaDashboardMetrics | null>(null);
  const [settings, setSettings] = useState<BetaSettings | null>(null);
  const [pendingUsers, setPendingUsers] = useState<BetaProfileRow[]>([]);
  const [waitlist, setWaitlist] = useState<BetaWaitlistEntry[]>([]);
  const [maxUsers, setMaxUsers] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const [dashboardRes, usersRes, waitlistRes] = await Promise.all([
      fetch("/api/admin/beta"),
      fetch("/api/admin/beta?view=users&status=pending"),
      fetch("/api/admin/beta?view=waitlist&status=pending"),
    ]);

    if (dashboardRes.ok) {
      const payload = await dashboardRes.json();
      setMetrics(payload.metrics ?? null);
      setSettings(payload.settings ?? null);
      setMaxUsers(payload.settings?.maxBetaUsers?.toString() ?? "");
    }

    if (usersRes.ok) {
      const payload = await usersRes.json();
      setPendingUsers(payload.users ?? []);
    }

    if (waitlistRes.ok) {
      const payload = await waitlistRes.json();
      setWaitlist(payload.waitlist ?? []);
    }

    scheduleAdminHashScroll();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(patch: Partial<BetaSettings>) {
    setIsSaving(true);
    try {
      await fetch("/api/admin/beta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteOnly: patch.inviteOnly ?? settings?.inviteOnly,
          waitlistEnabled: patch.waitlistEnabled ?? settings?.waitlistEnabled,
          maxBetaUsers:
            patch.maxBetaUsers !== undefined
              ? patch.maxBetaUsers
              : maxUsers
                ? Number(maxUsers)
                : null,
        }),
      });
      await load();
    } finally {
      setIsSaving(false);
    }
  }

  async function updateBetaUser(userId: string, betaStatus: BetaUserStatus) {
    await fetch("/api/admin/beta", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, betaStatus }),
    });
    await load();
  }

  async function updateWaitlistEntry(waitlistId: string, waitlistStatus: BetaUserStatus) {
    await fetch("/api/admin/beta", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitlistId, waitlistStatus }),
    });
    await load();
  }

  const topPages = useMemo(() => metrics?.topPages ?? [], [metrics?.topPages]);

  async function exportCsv(type: "users" | "feedback") {
    const response = await fetch("/api/admin/beta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exportType: type }),
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${type}-export.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-14">
      <Section id="beta" title="Beta management" description="Control beta access, waitlist, and program health.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending beta users" value={String(metrics?.pendingBetaUsers ?? 0)} change="" mutedChange />
          <StatCard label="Approved users" value={String(metrics?.approvedBetaUsers ?? 0)} change="" mutedChange />
          <StatCard label="Rejected users" value={String(metrics?.rejectedBetaUsers ?? 0)} change="" mutedChange positive={false} />
          <StatCard label="Waitlist pending" value={String(metrics?.waitlistPending ?? 0)} change="" mutedChange />
        </div>

        <Card padding="lg">
          <CardHeader title="Beta settings" />
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings?.inviteOnly ?? false}
                onChange={(event) => void saveSettings({ inviteOnly: event.target.checked })}
              />
              Invite-only mode
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings?.waitlistEnabled ?? true}
                onChange={(event) => void saveSettings({ waitlistEnabled: event.target.checked })}
              />
              Waitlist enabled when beta is full
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1 text-sm">
                <span className="mb-2 block text-[var(--text-muted)]">Maximum beta users</span>
                <Input value={maxUsers} onChange={(event) => setMaxUsers(event.target.value)} placeholder="Unlimited" />
              </label>
              <Button size="md" disabled={isSaving} onClick={() => void saveSettings({})}>
                Save limit
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="lg">
            <CardHeader title="Pending beta users" />
            <CardContent className="space-y-3">
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No pending users.</p>
              ) : (
                pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--surface-border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {user.fullName ?? user.email ?? user.id}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void updateBetaUser(user.id, "approved")}>
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void updateBetaUser(user.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card padding="lg">
            <CardHeader title="Waitlist queue" />
            <CardContent className="space-y-3">
              {waitlist.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No pending waitlist entries.</p>
              ) : (
                waitlist.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--surface-border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {entry.fullName ?? entry.email}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{entry.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void updateWaitlistEntry(entry.id, "approved")}>
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void updateWaitlistEntry(entry.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="beta-analytics" title="Beta analytics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open feedback" value={String(metrics?.feedbackStats.open ?? 0)} change="" mutedChange />
          <StatCard label="Bug reports" value={String(metrics?.feedbackStats.bugs ?? 0)} change="" mutedChange positive={false} />
          <StatCard label="Plaid connection rate" value={`${metrics?.plaidConnectionRate ?? 0}%`} change="" mutedChange />
          <StatCard label="Subscription conversion" value={`${metrics?.subscriptionConversion ?? 0}%`} change="" mutedChange />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminChart title="Daily signups" points={metrics?.dailySignups ?? []} />
          <AdminChart title="Daily active users" points={metrics?.dailyActiveUsers ?? []} />
        </div>
        {topPages.length > 0 ? (
          <Card padding="lg">
            <CardHeader title="Top pages (from feedback context)" />
            <CardContent className="space-y-2">
              {topPages.map((item) => (
                <div
                  key={item.page}
                  className="flex items-center justify-between gap-4 border-b border-[var(--surface-border)] py-2 text-sm last:border-b-0"
                >
                  <span className="truncate text-[var(--foreground)]">{item.page}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </Section>

      <Section id="beta-features" title="Feature request leaderboard">
        <div className="space-y-3">
          {(metrics?.featureLeaderboard ?? []).map((item) => (
            <Card key={item.message} padding="default">
              <CardContent className="flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--foreground)]">{item.message}</span>
                <span className="tabular-nums text-[var(--text-muted)]">{item.count}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="beta-exports" title="Exports">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" onClick={() => void exportCsv("users")}>
            Export users CSV
          </Button>
          <Button variant="secondary" size="md" onClick={() => void exportCsv("feedback")}>
            Export feedback CSV
          </Button>
        </div>
      </Section>
    </div>
  );
}
