"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui";
import { IosBottomSheet } from "@/components/native/designSystem";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { eligibleLinkAccounts, formatBankAccountLabel } from "@/lib/budgets/accountDisplay";
import { formatCurrency } from "@/lib/finance/format";
import {
  resolveAllocationAmounts,
  validateAllocations,
} from "@/lib/incomePlan/allocations";
import { computeNextPayDate, describePaySchedule, formatPayDate } from "@/lib/incomePlan/payDates";
import {
  INCOME_PLAN_SCHEDULE_LABELS,
  WEEKDAY_LABELS,
  type IncomePlan,
  type IncomePlanAllocation,
  type IncomePlanSchedule,
  type SaveIncomePlanInput,
} from "@/lib/incomePlan/types";
import { toDateString } from "@/lib/recurring/schedule";
import { triggerHaptic } from "@/lib/native/haptics";

const SCHEDULE_OPTIONS: IncomePlanSchedule[] = [
  "weekly",
  "biweekly",
  "twice_monthly",
  "monthly",
  "custom",
];

type Step = "schedule" | "details" | "review";

function defaultAllocations(): Omit<IncomePlanAllocation, "id">[] {
  return [
    {
      name: "House Savings",
      icon: "🏠",
      amount: null,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: null,
      goalId: null,
      billId: null,
      debtId: null,
      investmentId: null,
      monthlyTarget: null,
      contributionFrequency: null,
      sortOrder: 0,
    },
    {
      name: "Bills",
      icon: "💳",
      amount: null,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: null,
      goalId: null,
      billId: null,
      debtId: null,
      investmentId: null,
      monthlyTarget: null,
      contributionFrequency: null,
      sortOrder: 1,
    },
    {
      name: "Spending",
      icon: "🛍️",
      amount: null,
      percentage: null,
      allocationType: "remaining",
      isRemainingBalance: true,
      accountId: null,
      goalId: null,
      billId: null,
      debtId: null,
      investmentId: null,
      monthlyTarget: null,
      contributionFrequency: null,
      sortOrder: 2,
    },
  ];
}

function allocationPayload(plan: IncomePlan | null): Omit<IncomePlanAllocation, "id">[] {
  const source = plan?.allocations?.length ? plan.allocations : defaultAllocations();
  return source.map((item, index) => ({
    name: item.name,
    icon: item.icon,
    amount: item.amount,
    percentage: item.percentage ?? null,
    allocationType: item.allocationType ?? null,
    isRemainingBalance: item.isRemainingBalance,
    accountId: item.accountId,
    goalId: item.goalId,
    billId: item.billId ?? null,
    debtId: item.debtId ?? null,
    investmentId: item.investmentId ?? null,
    monthlyTarget: item.monthlyTarget,
    contributionFrequency: item.contributionFrequency ?? null,
    sortOrder: index,
  }));
}

type IosIncomeScheduleSheetProps = {
  open: boolean;
  onClose: () => void;
  onReviewAllocations?: () => void;
};

/**
 * Native paycheck schedule editor — calls finance.saveIncomePlan with the same
 * SaveIncomePlanInput shape as IncomePlanContent. Does not rewrite pay-date engines.
 */
export function IosIncomeScheduleSheet({
  open,
  onClose,
  onReviewAllocations,
}: IosIncomeScheduleSheetProps) {
  const finance = useFinance();
  const { showToast } = useToast();
  const existing = finance.incomePlan;
  const [step, setStep] = useState<Step>("schedule");
  const [isSaving, startSave] = useTransition();

  const [paySchedule, setPaySchedule] = useState<IncomePlanSchedule>("biweekly");
  const [paycheckAmount, setPaycheckAmount] = useState("");
  const [anchorDate, setAnchorDate] = useState(toDateString(new Date()));
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState(new Date().getDay());
  const [monthlyDays, setMonthlyDays] = useState<number[]>([1, 15]);
  const [customIntervalDays, setCustomIntervalDays] = useState("14");
  const [depositAccountId, setDepositAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("schedule");
    if (existing) {
      setPaySchedule(existing.paySchedule);
      setPaycheckAmount(String(existing.paycheckAmount));
      setAnchorDate(existing.anchorDate);
      setWeeklyDayOfWeek(existing.weeklyDayOfWeek ?? new Date().getDay());
      setMonthlyDays(
        existing.monthlyDays?.length ? existing.monthlyDays : [1, 15],
      );
      setCustomIntervalDays(String(existing.customIntervalDays ?? 14));
      setDepositAccountId(existing.depositAccountId);
    } else {
      setPaySchedule("biweekly");
      setPaycheckAmount("");
      setAnchorDate(toDateString(new Date()));
      setWeeklyDayOfWeek(new Date().getDay());
      setMonthlyDays([1, 15]);
      setCustomIntervalDays("14");
      setDepositAccountId(
        finance.accounts.find((account) => account.type === "checking")?.id ??
          finance.accounts[0]?.id ??
          null,
      );
    }
  }, [existing, finance.accounts, open]);

  const accounts = useMemo(
    () => eligibleLinkAccounts(finance.accounts),
    [finance.accounts],
  );

  const amountValue = Number.parseFloat(paycheckAmount);
  const draftPlan = useMemo(() => {
    const custom =
      paySchedule === "custom" ? Number.parseInt(customIntervalDays, 10) || 14 : null;
    const weekDay =
      paySchedule === "weekly" || paySchedule === "biweekly" ? weeklyDayOfWeek : null;
    const days =
      paySchedule === "twice_monthly"
        ? monthlyDays
        : paySchedule === "monthly"
          ? [monthlyDays[0] ?? 1]
          : [1, 15];
    return {
      paySchedule,
      paycheckAmount: Number.isFinite(amountValue) ? amountValue : 0,
      anchorDate,
      weeklyDayOfWeek: weekDay,
      monthlyDays: days,
      customIntervalDays: custom,
      depositAccountId,
      nextPayDate: anchorDate,
      lastProcessedDate: null,
      isActive: true,
      id: existing?.id ?? "draft",
      allocations: (existing?.allocations ?? []).map((item, index) => ({
        ...item,
        sortOrder: index,
      })),
      linkedIncomeSourceId: existing?.linkedIncomeSourceId,
      ownerUserId: existing?.ownerUserId,
    } satisfies IncomePlan;
  }, [
    amountValue,
    anchorDate,
    customIntervalDays,
    depositAccountId,
    existing,
    monthlyDays,
    paySchedule,
    weeklyDayOfWeek,
  ]);

  const previewNext = useMemo(() => {
    try {
      return computeNextPayDate(paySchedule, anchorDate, new Date(), {
        weeklyDayOfWeek:
          paySchedule === "weekly" || paySchedule === "biweekly"
            ? weeklyDayOfWeek
            : null,
        monthlyDays:
          paySchedule === "twice_monthly"
            ? monthlyDays
            : paySchedule === "monthly"
              ? [monthlyDays[0] ?? 1]
              : undefined,
        customIntervalDays:
          paySchedule === "custom"
            ? Number.parseInt(customIntervalDays, 10) || 14
            : null,
      });
    } catch {
      return anchorDate;
    }
  }, [
    anchorDate,
    customIntervalDays,
    monthlyDays,
    paySchedule,
    weeklyDayOfWeek,
  ]);

  const resolved = useMemo(() => {
    if (!existing?.allocations?.length) return [];
    return resolveAllocationAmounts({
      ...existing,
      paycheckAmount: Number.isFinite(amountValue) && amountValue > 0
        ? amountValue
        : existing.paycheckAmount,
    });
  }, [amountValue, existing]);

  function buildInput(): SaveIncomePlanInput | null {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      showToast({
        title: "Enter paycheck amount",
        subtitle: "Use your typical take-home pay.",
      });
      return null;
    }

    const allocations = allocationPayload(existing);
    const validationError = validateAllocations(amountValue, allocations);
    if (validationError) {
      showToast({ title: "Check allocations", subtitle: validationError });
      return null;
    }

    return {
      paySchedule,
      paycheckAmount: amountValue,
      anchorDate,
      weeklyDayOfWeek:
        paySchedule === "weekly" || paySchedule === "biweekly"
          ? weeklyDayOfWeek
          : null,
      monthlyDays:
        paySchedule === "twice_monthly"
          ? monthlyDays
          : paySchedule === "monthly"
            ? [monthlyDays[0] ?? 1]
            : [1, 15],
      customIntervalDays:
        paySchedule === "custom"
          ? Number.parseInt(customIntervalDays, 10) || 14
          : null,
      depositAccountId,
      ...(existing?.linkedIncomeSourceId
        ? { linkedIncomeSourceId: existing.linkedIncomeSourceId }
        : {}),
      allocations,
    };
  }

  function handleSave() {
    const input = buildInput();
    if (!input) return;

    startSave(async () => {
      try {
        await finance.saveIncomePlan(input);
        void triggerHaptic("success");
        showToast({
          title: existing ? "Pay schedule updated" : "Income Plan ready",
          subtitle: "Your next paycheck uses this schedule.",
          type: "success",
        });
        onClose();
      } catch {
        // FinanceContext surfaces errors
      }
    });
  }

  const title =
    step === "schedule"
      ? existing
        ? "Pay schedule"
        : "Set up paycheck plan"
      : step === "details"
        ? "Paycheck details"
        : "Review";

  return (
    <IosBottomSheet
      open={open}
      title={title}
      onClose={() => {
        if (isSaving) return;
        onClose();
      }}
      footer={
        <div className="flex gap-2" data-ios-income-schedule-footer="true">
          {step !== "schedule" ? (
            <button
              type="button"
              className="min-h-12 flex-1 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--foreground)]"
              disabled={isSaving}
              onClick={() =>
                setStep(step === "review" ? "details" : "schedule")
              }
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              className="min-h-12 flex-1 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--foreground)]"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          {step !== "review" ? (
            <button
              type="button"
              className="min-h-12 flex-1 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white"
              onClick={() => {
                void triggerHaptic("selection");
                setStep(step === "schedule" ? "details" : "review");
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="min-h-12 flex-1 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white disabled:opacity-50"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving
                ? "Saving…"
                : existing
                  ? "Save schedule"
                  : "Save plan"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 pb-2" data-ios-income-schedule-sheet="true">
        {step === "schedule" ? (
          <div className="space-y-2" role="listbox" aria-label="Pay frequency">
            <p className="text-[13px] text-[var(--text-muted)]">
              How often do you get paid?
            </p>
            {SCHEDULE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={paySchedule === option}
                className={`flex min-h-12 w-full items-center justify-between rounded-[14px] px-3.5 text-left text-[15px] font-medium active:opacity-80 ${
                  paySchedule === option
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white/[0.06] text-[var(--foreground)]"
                }`}
                onClick={() => {
                  void triggerHaptic("selection");
                  setPaySchedule(option);
                }}
              >
                {INCOME_PLAN_SCHEDULE_LABELS[option]}
                {paySchedule === option ? (
                  <span className="text-[13px] font-semibold">Selected</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {step === "details" ? (
          <div className="space-y-3">
            <label className="block text-[12px] font-medium text-[var(--text-muted)]">
              Paycheck amount
              <Input
                className="mt-1.5 min-h-12"
                inputMode="decimal"
                value={paycheckAmount}
                onChange={(event) => setPaycheckAmount(event.target.value)}
                aria-label="Paycheck amount"
                placeholder="0.00"
              />
            </label>

            <label className="block text-[12px] font-medium text-[var(--text-muted)]">
              Expected payday / anchor
              <Input
                className="mt-1.5 min-h-12"
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                aria-label="Expected payday"
              />
            </label>

            {paySchedule === "weekly" || paySchedule === "biweekly" ? (
              <label className="block text-[12px] font-medium text-[var(--text-muted)]">
                Weekday
                <select
                  className="mt-1.5 min-h-12 w-full rounded-[12px] border border-white/[0.08] bg-[var(--surface)] px-3 text-[15px] text-[var(--foreground)]"
                  value={weeklyDayOfWeek}
                  onChange={(event) =>
                    setWeeklyDayOfWeek(Number.parseInt(event.target.value, 10))
                  }
                  aria-label="Pay weekday"
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      Every {paySchedule === "biweekly" ? "other " : ""}
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {paySchedule === "twice_monthly" ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[12px] font-medium text-[var(--text-muted)]">
                  First day
                  <Input
                    className="mt-1.5 min-h-12"
                    type="number"
                    min={1}
                    max={31}
                    value={monthlyDays[0] ?? 1}
                    onChange={(event) =>
                      setMonthlyDays([
                        Number.parseInt(event.target.value, 10) || 1,
                        monthlyDays[1] ?? 15,
                      ])
                    }
                  />
                </label>
                <label className="block text-[12px] font-medium text-[var(--text-muted)]">
                  Second day
                  <Input
                    className="mt-1.5 min-h-12"
                    type="number"
                    min={1}
                    max={31}
                    value={monthlyDays[1] ?? 15}
                    onChange={(event) =>
                      setMonthlyDays([
                        monthlyDays[0] ?? 1,
                        Number.parseInt(event.target.value, 10) || 15,
                      ])
                    }
                  />
                </label>
              </div>
            ) : null}

            {paySchedule === "monthly" ? (
              <label className="block text-[12px] font-medium text-[var(--text-muted)]">
                Day of month
                <Input
                  className="mt-1.5 min-h-12"
                  type="number"
                  min={1}
                  max={31}
                  value={monthlyDays[0] ?? 1}
                  onChange={(event) =>
                    setMonthlyDays([Number.parseInt(event.target.value, 10) || 1])
                  }
                />
              </label>
            ) : null}

            {paySchedule === "custom" ? (
              <label className="block text-[12px] font-medium text-[var(--text-muted)]">
                Days between paychecks
                <Input
                  className="mt-1.5 min-h-12"
                  type="number"
                  min={1}
                  value={customIntervalDays}
                  onChange={(event) => setCustomIntervalDays(event.target.value)}
                />
              </label>
            ) : null}

            <label className="block text-[12px] font-medium text-[var(--text-muted)]">
              Deposit account
              <select
                className="mt-1.5 min-h-12 w-full rounded-[12px] border border-white/[0.08] bg-[var(--surface)] px-3 text-[15px] text-[var(--foreground)]"
                value={depositAccountId ?? ""}
                onChange={(event) =>
                  setDepositAccountId(event.target.value || null)
                }
                aria-label="Deposit account"
              >
                <option value="">Unassigned</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatBankAccountLabel(account)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-3">
            <div className="rounded-[16px] bg-white/[0.04] px-3.5 py-3">
              <p className="text-[12px] text-[var(--text-muted)]">Schedule</p>
              <p className="mt-1 text-[15px] font-semibold text-[var(--foreground)]">
                {INCOME_PLAN_SCHEDULE_LABELS[paySchedule]}
              </p>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {describePaySchedule(draftPlan)} · Next{" "}
                {formatPayDate(previewNext)}
              </p>
            </div>
            <div className="rounded-[16px] bg-white/[0.04] px-3.5 py-3">
              <p className="text-[12px] text-[var(--text-muted)]">Amount</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--foreground)]">
                {Number.isFinite(amountValue) && amountValue > 0
                  ? formatCurrency(amountValue)
                  : "—"}
              </p>
            </div>

            <div className="rounded-[16px] bg-white/[0.04] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-[var(--text-muted)]">Allocations</p>
                {existing && onReviewAllocations ? (
                  <button
                    type="button"
                    className="min-h-11 text-[13px] font-semibold text-[var(--accent-light)]"
                    onClick={() => {
                      void triggerHaptic("light");
                      onClose();
                      onReviewAllocations();
                    }}
                  >
                    Edit amounts
                  </button>
                ) : null}
              </div>
              {resolved.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {resolved.map((item) => (
                    <li
                      key={item.allocation.id}
                      className="flex justify-between gap-2 text-[13px]"
                    >
                      <span className="truncate text-[var(--text-secondary)]">
                        {item.allocation.icon} {item.allocation.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--foreground)]">
                        {formatCurrency(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                  {existing
                    ? "No allocations yet — save schedule, then edit amounts."
                    : "Default envelopes will be created. You can edit amounts after saving."}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </IosBottomSheet>
  );
}
