"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PayBillSplitModal } from "@/components/bills/PayBillSplitModal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  SkeletonGrid,
} from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  formatCalendarMonthLabel,
  getBillsForCalendarDate,
  getCalendarMonthDays,
  getCalendarStatusVariant,
} from "@/lib/finance/calendar";
import { getBillProgressList } from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import type { BillProgress, CalendarDaySummary } from "@/lib/finance/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function CalendarDayCell({
  day,
  selectedDate,
  onSelect,
}: {
  day: CalendarDaySummary;
  selectedDate: string | null;
  onSelect: (dateKey: string) => void;
}) {
  const isSelected = selectedDate === day.date;
  const hasBills = day.bills.length > 0;
  const variant = getCalendarStatusVariant(day.dominantStatus);

  return (
    <button
      type="button"
      onClick={() => onSelect(day.date)}
      className={cn(
        "flex min-h-[5.5rem] flex-col rounded-2xl border p-3 text-left transition-colors",
        isSelected
          ? "border-[#0077ed]/40 bg-[#0077ed]/10"
          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white">{day.day}</span>
        {hasBills && (
          <span
            className={cn(
              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
              variant === "success" && "bg-emerald-400",
              variant === "accent" && "bg-[#0077ed]",
              variant === "warning" && "bg-amber-400",
              variant === "danger" && "bg-rose-400",
              variant === "default" && "bg-white/30",
            )}
          />
        )}
      </div>
      {hasBills && (
        <p className="mt-auto pt-2 text-xs text-white/45">
          {day.bills.length} bill{day.bills.length === 1 ? "" : "s"}
        </p>
      )}
    </button>
  );
}

export function CalendarContent() {
  const finance = useFinance();
  const { markBillSplitPaid } = finance;
  const { showToast } = useToast();
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
  );
  const [paySplit, setPaySplit] = useState<BillProgress | null>(null);

  const monthDays = useMemo(
    () =>
      getCalendarMonthDays(
        finance,
        viewDate.getFullYear(),
        viewDate.getMonth(),
      ),
    [finance, viewDate],
  );

  const leadingBlanks = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1,
  ).getDay();

  const selectedBills = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return getBillsForCalendarDate(finance, parseDateKey(selectedDate));
  }, [finance, selectedDate]);

  function shiftMonth(offset: number) {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function findSplitProgress(billId: string, splitId: string) {
    return getBillProgressList(finance).find(
      (entry) => entry.billId === billId && entry.splitId === splitId,
    );
  }

  async function handleConfirmPayment(amount: number) {
    if (!paySplit) {
      return;
    }

    await markBillSplitPaid(paySplit.billId, paySplit.splitId, amount);
    showToast({
      title: "Payment recorded",
      subtitle: paySplit.name,
    });
    setPaySplit(null);
  }

  if (finance.isLoading) {
    return <SkeletonGrid count={3} />;
  }

  return (
    <div className={cn(pageContainerWideClassName, "space-y-8")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-white/45">Upcoming bills</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {formatCalendarMonthLabel(
              viewDate.getFullYear(),
              viewDate.getMonth(),
            )}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => shiftMonth(-1)}>
            Previous
          </Button>
          <Button variant="secondary" onClick={() => shiftMonth(1)}>
            Next
          </Button>
          <Link href="/bills">
            <Button variant="secondary">Manage bills</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card padding="lg">
          <CardHeader title="Monthly view" />
          <CardContent>
            <div className="mb-3 grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-xs font-medium uppercase tracking-wide text-white/35"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: leadingBlanks }).map((_, index) => (
                <div key={`blank-${index}`} />
              ))}
              {monthDays.map((day) => (
                <CalendarDayCell
                  key={day.date}
                  day={day}
                  selectedDate={selectedDate}
                  onSelect={setSelectedDate}
                />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/45">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Paid
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#0077ed]" />
                Due today
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Due soon
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/30" />
                Upcoming
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Overdue
              </span>
            </div>
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader
            title={
              selectedDate
                ? parseDateKey(selectedDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Select a date"
            }
          />
          <CardContent>
            {selectedBills.length === 0 ? (
              <EmptyState
                title="No bills due"
                description="Nothing is scheduled for this day."
              />
            ) : (
              <ul className="space-y-3">
                {selectedBills.map((bill) => {
                  const progress = findSplitProgress(bill.billId, bill.splitId);
                  const canPay = bill.status !== "paid" && progress;

                  return (
                    <li
                      key={bill.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-white">{bill.name}</p>
                        <p className="text-sm text-white/45">{bill.category}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="font-medium text-white">
                            {formatCurrency(bill.amount)}
                          </p>
                          <Badge variant={getCalendarStatusVariant(bill.status)}>
                            {bill.statusLabel}
                          </Badge>
                        </div>
                        {canPay && progress && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPaySplit(progress)}
                          >
                            Pay
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <PayBillSplitModal
        split={paySplit}
        isOpen={paySplit !== null}
        onClose={() => setPaySplit(null)}
        onConfirm={handleConfirmPayment}
      />
    </div>
  );
}
