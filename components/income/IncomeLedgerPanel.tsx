"use client";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatLedgerEntry } from "@/lib/allocation/reportingEngine";
import { formatCurrency } from "@/lib/finance/format";

export function IncomeLedgerPanel() {
  const { snapshot } = useFinance();
  const { ledgerReport, ledgerAuditTrail } = snapshot;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader title="Total transferred" />
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-white">
              {formatCurrency(ledgerReport.totalTransferred)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Paycheck allocations" />
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-white">
              {formatCurrency(ledgerReport.paycheckAllocations)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Recurring contributions" />
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-white">
              {formatCurrency(ledgerReport.recurringContributions)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Allocation history"
          description="Every paycheck move is recorded here."
        />
        <CardContent>
          {ledgerAuditTrail.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              No allocation entries yet. Your plan runs automatically on payday.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {[...ledgerAuditTrail].reverse().slice(0, 50).map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-[var(--text-secondary)]">
                    {formatLedgerEntry(entry)}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {entry.destinationName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
