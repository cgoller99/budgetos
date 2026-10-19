"use client";

import { useMemo, useState } from "react";
import {
  IosBottomSheet,
  IosCard,
  IosDetailLine,
  IosEmptyState,
  IosList,
  IosListRow,
  IosSection,
  IosSegmentedControl,
} from "@/components/native/designSystem";
import { useFinance } from "@/context/FinanceContext";
import type { AllocationLedgerEntry } from "@/lib/allocation/types";
import { formatCurrency } from "@/lib/finance/format";
import { triggerHaptic } from "@/lib/native/haptics";

type HistoryFilter = "all" | "paycheck" | "recurring" | "manual";
type HistoryView = "history" | "forecast";

const FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paycheck", label: "Paychecks" },
  { value: "recurring", label: "Recurring" },
  { value: "manual", label: "Manual" },
];

const ENTRY_TYPE_FILTER: Record<HistoryFilter, AllocationLedgerEntry["entryType"] | null> = {
  all: null,
  paycheck: "paycheck_allocation",
  recurring: "recurring_contribution",
  manual: "manual_transfer",
};

const ENTRY_TYPE_LABEL: Record<AllocationLedgerEntry["entryType"], string> = {
  paycheck_allocation: "Paycheck",
  recurring_contribution: "Recurring",
  manual_transfer: "Manual",
};

const HORIZON_LABELS: Record<string, string> = {
  "30d": "30 days",
  "90d": "90 days",
  "6mo": "6 months",
  "1yr": "1 year",
};

type PaycheckGroup = {
  key: string;
  date: string;
  total: number;
  entryType: AllocationLedgerEntry["entryType"];
  entries: AllocationLedgerEntry[];
};

function groupEntries(entries: AllocationLedgerEntry[]): PaycheckGroup[] {
  const map = new Map<string, PaycheckGroup>();

  for (const entry of entries) {
    const key =
      entry.paycheckEventId ??
      `${entry.transferDate}:${entry.entryType}:${entry.destinationName}`;
    const existing = map.get(key);
    if (existing) {
      existing.total += entry.amount;
      existing.entries.push(entry);
      continue;
    }
    map.set(key, {
      key,
      date: entry.transferDate,
      total: entry.amount,
      entryType: entry.entryType,
      entries: [entry],
    });
  }

  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Native Income History — same ledger/forecast engines as web panels,
 * presented with iOS list chrome (no Card embeds).
 */
export function IosIncomeHistoryPanel({
  initialView = "history",
}: {
  initialView?: HistoryView;
}) {
  const { snapshot, incomePlan } = useFinance();
  const { ledgerReport, ledgerAuditTrail, forecasts } = snapshot;
  const [view, setView] = useState<HistoryView>(initialView);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [selected, setSelected] = useState<PaycheckGroup | null>(null);

  const filtered = useMemo(() => {
    const type = ENTRY_TYPE_FILTER[filter];
    const entries = type
      ? ledgerAuditTrail.filter((entry) => entry.entryType === type)
      : ledgerAuditTrail;
    return groupEntries([...entries].reverse());
  }, [filter, ledgerAuditTrail]);

  return (
    <div className="flex flex-col gap-3" data-ios-income-history="true">
      <IosSegmentedControl
        variant="pills"
        value={view}
        onChange={(next) => {
          void triggerHaptic("selection");
          setView(next);
        }}
        options={[
          { value: "history", label: "History" },
          { value: "forecast", label: "Forecast" },
        ]}
      />

      {view === "history" ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Transferred" value={formatCurrency(ledgerReport.totalTransferred)} />
            <Metric
              label="Paychecks"
              value={formatCurrency(ledgerReport.paycheckAllocations)}
            />
            <Metric
              label="Recurring"
              value={formatCurrency(ledgerReport.recurringContributions)}
            />
          </div>

          <div
            className="flex gap-2 overflow-x-auto pb-0.5"
            role="group"
            aria-label="History filters"
          >
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`min-h-11 shrink-0 rounded-[12px] px-3.5 text-[13px] font-semibold active:opacity-80 ${
                  filter === option.value
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white/[0.06] text-[var(--text-secondary)]"
                }`}
                aria-pressed={filter === option.value}
                onClick={() => {
                  void triggerHaptic("selection");
                  setFilter(option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <IosSection title="Paycheck history">
            {filtered.length === 0 ? (
              <IosEmptyState
                title="No history yet"
                subtitle="When paychecks allocate, each move shows up here. Balances are unchanged until payday runs."
              />
            ) : (
              <IosList>
                {filtered.slice(0, 50).map((group) => (
                  <IosListRow
                    key={group.key}
                    title={formatCurrency(group.total)}
                    subtitle={`${formatShortDate(group.date)} · ${ENTRY_TYPE_LABEL[group.entryType]}${
                      group.entries.length > 1 ? ` · ${group.entries.length} lines` : ""
                    }`}
                    trailing={
                      group.entries.length === 1
                        ? group.entries[0].destinationName
                        : "Details"
                    }
                    onClick={() => {
                      void triggerHaptic("selection");
                      setSelected(group);
                    }}
                  />
                ))}
              </IosList>
            )}
          </IosSection>
        </>
      ) : (
        <ForecastView incomePlan={Boolean(incomePlan)} forecasts={forecasts} />
      )}

      <IosBottomSheet
        open={selected !== null}
        title={selected ? formatShortDate(selected.date) : "Details"}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div data-ios-income-history-detail="true">
            <p className="text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--success)]">
              {formatCurrency(selected.total)}
            </p>
            <p className="mt-2 text-center text-[13px] text-[var(--text-muted)]">
              {ENTRY_TYPE_LABEL[selected.entryType]} · {selected.entries.length} line
              {selected.entries.length === 1 ? "" : "s"}
            </p>
            <div className="mt-5 rounded-[16px] bg-white/[0.04] px-3.5">
              {selected.entries.map((entry) => (
                <IosDetailLine
                  key={entry.id}
                  label={entry.destinationName}
                  value={formatCurrency(entry.amount)}
                />
              ))}
            </div>
            <p className="mt-3 px-1 text-[12px] leading-snug text-[var(--text-muted)]">
              Historical allocation record — does not create new transfers or change
              balances.
            </p>
          </div>
        ) : null}
      </IosBottomSheet>
    </div>
  );
}

function ForecastView({
  incomePlan,
  forecasts,
}: {
  incomePlan: boolean;
  forecasts: ReturnType<typeof useFinance>["snapshot"]["forecasts"];
}) {
  if (!incomePlan) {
    return (
      <IosEmptyState
        title="No paycheck plan"
        subtitle="Set up your Income Plan to see envelope balance forecasts."
      />
    );
  }

  if (forecasts.length === 0) {
    return (
      <IosEmptyState
        title="No forecasts yet"
        subtitle="Add allocations on your plan to project envelope balances."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3" data-ios-income-forecast="true">
      {forecasts.map((forecast) => (
        <IosCard key={forecast.horizon} padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            {HORIZON_LABELS[forecast.horizon] ?? forecast.horizon}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {forecast.paycheckCount} paychecks · {forecast.horizonDays} days · estimate only
          </p>
          <div className="mt-3 space-y-2">
            {forecast.envelopes.slice(0, 6).map((envelope) => (
              <div
                key={envelope.envelopeId}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate text-[13px] text-[var(--text-secondary)]">
                  {envelope.name}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(envelope.projectedBalance)}
                </span>
              </div>
            ))}
            {forecast.envelopes.length > 6 ? (
              <p className="text-[12px] text-[var(--text-muted)]">
                +{forecast.envelopes.length - 6} more
              </p>
            ) : null}
          </div>
        </IosCard>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] bg-white/[0.05] px-2.5 py-2.5">
      <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
