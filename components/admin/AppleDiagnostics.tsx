"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

type AuditRecord = {
  userId: string; name: string | null; verified: boolean;
  appleStatus?: string; expiresAt?: string | null;
};
type Environment = "Sandbox" | "Production";

export function AppleDiagnostics() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tokens, setTokens] = useState<Partial<Record<Environment, string>>>({});
  const [records, setRecords] = useState<AuditRecord[]>([]);

  async function requestTest(environment: Environment, check = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/apple-diagnostics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment, action: check ? "check_test" : "send_test", token: tokens[environment] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Apple diagnostic failed.");
      if (!check) {
        setTokens((previous) => ({ ...previous, [environment]: result.token }));
        setMessage(`${environment} test requested. Check delivery shortly.`);
      } else {
        const attempts = result.attempts as Array<{ sendAttemptResult?: string }>;
        setMessage(`${environment}: ${attempts.length ? attempts.map((attempt) => attempt.sendAttemptResult ?? "Unknown result").join(", ") : "Delivery pending. Check again shortly."}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apple diagnostic failed.");
    } finally { setBusy(false); }
  }

  async function reconcile(userId: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/apple-diagnostics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile_active", userId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Reconciliation failed.");
      setMessage("Verified Apple subscription synced. Refresh the dashboard for updated totals.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reconciliation failed.");
    } finally { setBusy(false); }
  }

  async function audit() {
    setBusy(true);
    setMessage("");
    setRecords([]);
    try {
      const response = await fetch("/api/admin/apple-diagnostics", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Apple audit failed.");
      setRecords(result.records);
      setMessage(`Read-only check complete: ${result.records.length} of ${result.total} records. No account access changed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apple audit failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-white/10 p-4">
      <h3 className="font-semibold">Apple subscription checks</h3>
      <p className="text-sm text-white/60">Test notification delivery or compare stored accounts with Apple. Delivery tests and verification are read-only. Sync applies only an active subscription freshly verified with Apple; it never charges or cancels billing.</p>
      <div className="flex flex-wrap gap-2">
        {(["Sandbox", "Production"] as const).map((environment) => (
          <div key={environment} className="flex gap-2">
            <Button disabled={busy} onClick={() => void requestTest(environment)}>Send {environment.toLowerCase()} test</Button>
            {tokens[environment] && <Button disabled={busy} onClick={() => void requestTest(environment, true)}>Check {environment.toLowerCase()} delivery</Button>}
          </div>
        ))}
        <Button disabled={busy} onClick={() => void audit()}>Verify Apple subscriptions</Button>
      </div>
      <p role="status" className="text-sm text-white/70">{busy ? "Checking Apple…" : message}</p>
      {records.length > 0 && <ul className="space-y-2 text-sm">
        {records.map((record) => <li key={record.userId}>
          {record.name || "Unnamed account"}: {record.verified ? `${record.appleStatus}${record.expiresAt ? `; period ends ${new Date(record.expiresAt).toLocaleDateString()}` : ""}` : "Could not verify; account unchanged"}
          {record.verified && record.appleStatus === "active" && <Button disabled={busy} onClick={() => void reconcile(record.userId)}>Sync {record.name || "account"} subscription</Button>}
        </li>)}
      </ul>}
    </div>
  );
}
