"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  IosAvatar,
  IosCard,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { PayBillSplitModal } from "@/components/bills/PayBillSplitModal";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  formatCalendarMonthLabel,
  getBillsForCalendarDate,
  getCalendarMonthDays,
} from "@/lib/finance/calendar";
import { formatCurrency } from "@/lib/finance/format";
import type { BillProgress } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function IosCalendarScreen() {
  const finance = useFinance();
  const { markBillSplitPaid } = finance;
  const { showToast } = useToast();
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(today));
  const [paySplit, setPaySplit] = useState<BillProgress | null>(null);

  const monthDays = useMemo(
    () =>
      getCalendarMonthDays(finance, viewDate.getFullYear(), viewDate.getMonth()),
    [finance, viewDate],
  );

  const leadingBlanks = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1,
  ).getDay();

  const selectedBills = useMemo(() => {
    if (!selectedDate) return [];
    return getBillsForCalendarDate(finance, parseDateKey(selectedDate));
  }, [finance, selectedDate]);

  if (finance.isLoading) {
    return <IosSkeletonScreen rows={6} />;
  }

  const selectedLabel = selectedDate
    ? parseDateKey(selectedDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "Selected day";

  return (
    <IosScreen>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-muted)]">Calendar</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            {formatCalendarMonthLabel(viewDate.getFullYear(), viewDate.getMonth())}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IosTextButton
            onClick={() => {
              void triggerHaptic("selection");
              setViewDate(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              );
            }}
          >
            ‹
          </IosTextButton>
          <IosTextButton
            onClick={() => {
              void triggerHaptic("selection");
              setViewDate(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
              );
            }}
          >
            ›
          </IosTextButton>
        </div>
      </div>

      <IosCard padding="md">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="py-1 text-center text-[11px] font-semibold text-[var(--text-subtle)]"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <div key={`blank-${index}`} className="min-h-11" />
          ))}
          {monthDays.map((day) => {
            const selected = selectedDate === day.date;
            const isToday = day.date === toDateKey(today);
            const hasEvents = day.bills.length > 0 || day.events.length > 0;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => {
                  void triggerHaptic("selection");
                  setSelectedDate(day.date);
                }}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-[10px] text-[13px] font-medium",
                  selected && "bg-[var(--accent)] text-white",
                  !selected && isToday && "bg-[var(--accent)]/15 text-[var(--accent-light)]",
                  !selected && !isToday && "text-[var(--foreground)]",
                )}
              >
                {day.day}
                {hasEvents ? (
                  <span
                    className={cn(
                      "mt-0.5 size-1 rounded-full",
                      selected ? "bg-white" : "bg-[var(--accent-light)]",
                    )}
                  />
                ) : (
                  <span className="mt-0.5 size-1" />
                )}
              </button>
            );
          })}
        </div>
      </IosCard>

      <IosSection
        title={selectedLabel}
        action={
          <Link href="/bills" className="text-[13px] font-semibold text-[var(--accent-light)]">
            Bills
          </Link>
        }
      >
        {selectedBills.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">Nothing due this day.</p>
          </IosCard>
        ) : (
          <ul className="overflow-hidden rounded-[16px] bg-[var(--surface)]">
            {selectedBills.map((bill) => (
              <li
                key={`${bill.billId}-${bill.splitId}`}
                className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <IosAvatar
                    fallback={bill.name.slice(0, 1).toUpperCase()}
                    tone={bill.status === "overdue" ? "danger" : "accent"}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-[15px] font-medium",
                        bill.status === "overdue"
                          ? "text-[var(--danger)]"
                          : "text-[var(--foreground)]",
                      )}
                    >
                      {bill.name}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                      {bill.statusLabel}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(bill.remainingAmount || bill.amount)}
                </span>
                {bill.status !== "paid" ? (
                  <button
                    type="button"
                    className="min-h-8 shrink-0 rounded-full bg-[var(--accent)] px-3 text-[13px] font-semibold text-white active:opacity-80"
                    onClick={() => {
                      void triggerHaptic("light");
                      setPaySplit(bill);
                    }}
                  >
                    Pay
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </IosSection>

      <PayBillSplitModal
        split={paySplit}
        isOpen={paySplit !== null}
        onClose={() => setPaySplit(null)}
        onConfirm={async (amount) => {
          if (!paySplit) return;
          await markBillSplitPaid(paySplit.billId, paySplit.splitId, amount);
          void triggerHaptic("success");
          showToast({ title: "Payment recorded", subtitle: paySplit.name });
          setPaySplit(null);
        }}
      />
    </IosScreen>
  );
}
