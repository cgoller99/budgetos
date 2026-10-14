"use client";

import { useMemo } from "react";
import { IosCard, IosList, IosListRow, IosSection } from "@/components/native/ios/IosPrimitives";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import {
  describeCashOutlook,
  forecastCashOutlook,
  type CashOutlookKind,
} from "@/lib/finance/cashOutlook";
import { formatCurrency, formatSignedCurrency } from "@/lib/finance/format";
import { formatPayDate } from "@/lib/incomePlan/payDates";
import { useNativeIos } from "@/lib/native/useNativeIos";

const VISIBLE_EVENTS = 8;

const KIND_LABEL: Record<CashOutlookKind, string> = {
  paycheck: "Expected paycheck",
  bill: "Bill",
  recurring: "Recurring estimate",
  goal: "Goal contribution",
  debt: "Debt minimum",
};

export function CashOutlookCard({ detail = "full" }: { detail?: "full" | "summary" }) {
  const finance = useFinance();
  const nativeIos = useNativeIos();
  const outlook = useMemo(() => forecastCashOutlook(finance), [finance]);

  if (outlook.availableCash === 0 && outlook.events.length === 0) {
    return null;
  }

  const summary = describeCashOutlook(outlook);
  const visible = outlook.events.slice(0, VISIBLE_EVENTS);
  const hiddenCount = outlook.events.length - visible.length;
  const intro =
    detail === "summary"
      ? `Confirmed cash ${formatCurrency(outlook.availableCash)}. Estimates run through ${formatPayDate(outlook.endDate)}.`
      : `Confirmed cash ${formatCurrency(outlook.availableCash)}. Later rows are estimates through ${formatPayDate(outlook.endDate)}.`;

  if (nativeIos) {
    return (
      <IosSection title="30-day outlook">
        <IosCard padding="md">
          <p className="text-[13px] leading-snug text-[var(--text-muted)]">{intro}</p>
          {summary ? (
            <p className="mt-2 text-[13px] font-semibold leading-snug text-[var(--foreground)]">
              {summary}
            </p>
          ) : (
            <p className="mt-2 text-[13px] leading-snug text-[var(--text-muted)]">
              No dip below today’s confirmed cash in this window.
            </p>
          )}
        </IosCard>
        {detail === "full" && visible.length > 0 ? (
          <IosList>
            {visible.map((event) => (
              <IosListRow
                key={event.id}
                title={event.name}
                subtitle={`${formatPayDate(event.date)} · ${KIND_LABEL[event.kind]} · Estimate`}
                trailing={formatSignedCurrency(event.amount)}
                danger={event.balanceAfter < 0}
              />
            ))}
          </IosList>
        ) : null}
        {detail === "full" && hiddenCount > 0 ? (
          <p className="px-1 text-[12px] text-[var(--text-muted)]">
            {hiddenCount} more estimated {hiddenCount === 1 ? "item" : "items"} in this window.
          </p>
        ) : null}
      </IosSection>
    );
  }

  return (
    <Card>
      <CardHeader
        title="30-day outlook"
        description={intro}
      />
      <CardContent>
        {summary ? (
          <p className="text-sm font-semibold text-[var(--foreground)]">{summary}</p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            No dip below today’s confirmed cash in this window.
          </p>
        )}
        {visible.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {visible.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">{event.name}</p>
                  <p className="text-[13px] text-[var(--text-muted)]">
                    {formatPayDate(event.date)} · {KIND_LABEL[event.kind]} · Estimate · cash {formatCurrency(event.balanceAfter)}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    event.amount < 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
                  }`}
                >
                  {formatSignedCurrency(event.amount)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {hiddenCount > 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {hiddenCount} more estimated {hiddenCount === 1 ? "item" : "items"} in this window.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
