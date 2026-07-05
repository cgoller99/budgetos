"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  FormField,
  PageHeader,
  SkeletonGrid,
} from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { AllocationSummary } from "@/components/incomePlan/AllocationSummary";
import { MonthlyAllocationProgress, NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import {
  formatAllocationAmountInput,
  getAllocationSummary,
  parseAllocationAmountInput,
  suggestAllocationIcons,
  validateAllocations,
  resolveAllocationAmounts,
} from "@/lib/incomePlan/allocations";
import { describePaySchedule } from "@/lib/incomePlan/payDates";
import {
  EXTRA_PAYCHECK_SUGGESTIONS,
  INCOME_PLAN_SCHEDULE_LABELS,
  WEEKDAY_LABELS,
  type IncomePlanAllocation,
  type IncomePlanSchedule,
  type SaveIncomePlanInput,
} from "@/lib/incomePlan/types";
import { formatCurrency } from "@/lib/finance/format";
import { toDateString } from "@/lib/recurring/schedule";
import { cn } from "@/components/ui/cn";

type SetupStep = 1 | 2 | 3;

const SCHEDULE_OPTIONS: IncomePlanSchedule[] = [
  "weekly",
  "biweekly",
  "twice_monthly",
  "monthly",
  "custom",
];

type AllocationDraft = Omit<IncomePlanAllocation, "id"> & { id?: string };

function defaultAllocations(): AllocationDraft[] {
  return [
    {
      name: "House Savings",
      icon: "🏠",
      amount: null,
      isRemainingBalance: false,
      accountId: null,
      goalId: null,
      monthlyTarget: null,
      sortOrder: 0,
    },
    {
      name: "Vacation",
      icon: "✈️",
      amount: null,
      isRemainingBalance: false,
      accountId: null,
      goalId: null,
      monthlyTarget: null,
      sortOrder: 1,
    },
    {
      name: "Bills",
      icon: "💳",
      amount: null,
      isRemainingBalance: false,
      accountId: null,
      goalId: null,
      monthlyTarget: null,
      sortOrder: 2,
    },
    {
      name: "Spending",
      icon: "🛍️",
      amount: null,
      isRemainingBalance: true,
      accountId: null,
      goalId: null,
      monthlyTarget: null,
      sortOrder: 3,
    },
  ];
}

export function IncomePlanContent() {
  const finance = useFinance();
  const { showToast } = useToast();
  const [step, setStep] = useState<SetupStep>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const existing = finance.incomePlan;

  const [paySchedule, setPaySchedule] = useState<IncomePlanSchedule>(
    existing?.paySchedule ?? "biweekly",
  );
  const [paycheckAmount, setPaycheckAmount] = useState(
    existing?.paycheckAmount?.toString() ?? "",
  );
  const [anchorDate, setAnchorDate] = useState(
    existing?.anchorDate ?? toDateString(new Date()),
  );
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState<number>(
    existing?.weeklyDayOfWeek ?? new Date().getDay(),
  );
  const [monthlyDays, setMonthlyDays] = useState<number[]>(
    existing?.monthlyDays ?? [1, 15],
  );
  const [customIntervalDays, setCustomIntervalDays] = useState(
    existing?.customIntervalDays?.toString() ?? "14",
  );
  const [depositAccountId, setDepositAccountId] = useState<string | null>(
    existing?.depositAccountId ??
      finance.accounts.find((account) => account.type === "checking")?.id ??
      finance.accounts[0]?.id ??
      null,
  );
  const [allocations, setAllocations] = useState<AllocationDraft[]>(
    existing?.allocations ?? defaultAllocations(),
  );
  const [amountInputs, setAmountInputs] = useState<string[]>(() =>
    (existing?.allocations ?? defaultAllocations()).map((item) =>
      item.isRemainingBalance
        ? ""
        : formatAllocationAmountInput(item.amount),
    ),
  );

  const paycheckAmountValue = Number.parseFloat(paycheckAmount) || 0;

  const parsedAllocations = useMemo(
    () =>
      allocations.map((item, index) => ({
        ...item,
        amount: item.isRemainingBalance
          ? null
          : parseAllocationAmountInput(amountInputs[index] ?? ""),
      })),
    [allocations, amountInputs],
  );

  const allocationSummary = useMemo(
    () => getAllocationSummary(paycheckAmountValue, parsedAllocations),
    [parsedAllocations, paycheckAmountValue],
  );

  const resolvedExisting = useMemo(
    () => (existing ? resolveAllocationAmounts(existing) : []),
    [existing],
  );

  useEffect(() => {
    if (!showSettings || !existing) {
      return;
    }

    setPaySchedule(existing.paySchedule);
    setPaycheckAmount(String(existing.paycheckAmount));
    setAnchorDate(existing.anchorDate);
    setWeeklyDayOfWeek(existing.weeklyDayOfWeek ?? new Date().getDay());
    setMonthlyDays(existing.monthlyDays);
    setCustomIntervalDays(String(existing.customIntervalDays ?? 14));
    setDepositAccountId(existing.depositAccountId);
    setAllocations(existing.allocations);
    setAmountInputs(
      existing.allocations.map((item) =>
        item.isRemainingBalance ? "" : formatAllocationAmountInput(item.amount),
      ),
    );
    setStep(1);
  }, [existing, showSettings]);

  const previewPlan = useMemo(
    () =>
      existing
        ? {
            ...existing,
            paySchedule,
            paycheckAmount: Number.parseFloat(paycheckAmount) || 0,
            anchorDate,
            weeklyDayOfWeek,
            monthlyDays,
            customIntervalDays: Number.parseInt(customIntervalDays, 10) || 14,
            depositAccountId,
            allocations: allocations.map((item, index) => ({
              ...item,
              id: item.id ?? `draft-${index}`,
              sortOrder: index,
            })),
          }
        : null,
    [
      allocations,
      anchorDate,
      customIntervalDays,
      depositAccountId,
      existing,
      monthlyDays,
      paySchedule,
      paycheckAmount,
      weeklyDayOfWeek,
    ],
  );

  if (finance.isLoading) {
    return <SkeletonGrid count={4} />;
  }

  async function handleSave() {
    const amount = Number.parseFloat(paycheckAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast({
        title: "Enter paycheck amount",
        subtitle: "Use your typical take-home pay.",
      });
      return;
    }

    const normalizedAllocations = parsedAllocations.map((item, index) => ({
      ...item,
      name: item.name.trim() || "Category",
      icon: item.icon || suggestAllocationIcons(item.name),
      sortOrder: index,
    }));

    const validationError = validateAllocations(amount, normalizedAllocations);

    if (validationError) {
      showToast({ title: "Check allocations", subtitle: validationError });
      return;
    }

    const input: SaveIncomePlanInput = {
      paySchedule,
      paycheckAmount: amount,
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
      allocations: normalizedAllocations,
    };

    setIsSaving(true);

    try {
      await finance.saveIncomePlan(input);
      showToast({
        title: existing ? "Income Plan updated" : "Income Plan ready",
        subtitle: "Your next paycheck is on the dashboard.",
        type: "success",
      });
      setShowSettings(false);
      setStep(1);
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsSaving(false);
    }
  }

  function updateAmountInput(index: number, value: string) {
    setAmountInputs((previous) =>
      previous.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }

  function updateAllocation(index: number, patch: Partial<AllocationDraft>) {
    setAllocations((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function addAllocation() {
    setAllocations((previous) => [
      ...previous,
      {
        name: "New category",
        icon: "💵",
        amount: null,
        isRemainingBalance: false,
        accountId: null,
        goalId: null,
        monthlyTarget: null,
        sortOrder: previous.length,
      },
    ]);
    setAmountInputs((previous) => [...previous, ""]);
  }

  function removeAllocation(index: number) {
    if (allocations.length <= 1) {
      return;
    }

    setAllocations((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
    setAmountInputs((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function setRemainingBalance(index: number) {
    setAllocations((previous) =>
      previous.map((item, itemIndex) => ({
        ...item,
        isRemainingBalance: itemIndex === index,
        amount:
          itemIndex === index
            ? null
            : parseAllocationAmountInput(amountInputs[itemIndex] ?? ""),
      })),
    );
    setAmountInputs((previous) =>
      previous.map((value, itemIndex) =>
        itemIndex === index ? "" : value,
      ),
    );
  }

  if (existing && !showSettings) {
    return (
      <div className={cn(pageContainerWideClassName, "space-y-6")}>
        <PageHeader
          action={
            <Button variant="secondary" onClick={() => setShowSettings(true)}>
              Edit plan
            </Button>
          }
        />

        <p className="text-sm text-[var(--text-muted)]">
          {describePaySchedule(existing)} · {formatCurrency(existing.paycheckAmount)} per paycheck
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <NextPaycheckCard />
          <MonthlyAllocationProgress />
        </div>

        <Card padding="lg">
          <CardHeader title="Allocation rules" />
          <CardContent className="space-y-3">
            {resolvedExisting.map(({ allocation, amount }) => (
              <div
                key={allocation.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{allocation.icon}</span>
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {allocation.name}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {allocation.isRemainingBalance
                        ? "Remaining balance"
                        : "Fixed amount"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {formatCurrency(amount)}
                  </span>
                  {allocation.isRemainingBalance && (
                    <Badge variant="accent">Remaining</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {previewPlan && (
          <Card padding="lg">
            <CardHeader
              title="Extra paycheck ideas"
              description="When bi-weekly pay lands three times in a month."
            />
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {EXTRA_PAYCHECK_SUGGESTIONS.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
                >
                  <p className="font-medium text-[var(--foreground)]">
                    {suggestion.icon} {suggestion.label}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {suggestion.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className={cn(pageContainerWideClassName, "space-y-6")}>
      <PageHeader
        action={
          existing ? (
            <Button variant="ghost" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
          ) : undefined
        }
      />

      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
          {existing ? "Edit Income Plan" : "Set up your Income Plan"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Budget around paychecks, not months. This takes about five minutes.
        </p>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((value) => (
          <div
            key={value}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              step >= value ? "bg-[#0077ed]" : "bg-[var(--surface-border)]",
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <Card padding="lg">
          <CardHeader
            title="How often do you get paid?"
            description="Pick the schedule that matches your paycheck."
          />
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {SCHEDULE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPaySchedule(option)}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition-colors",
                  paySchedule === option
                    ? "border-[#0077ed] bg-[#0077ed]/10"
                    : "border-[var(--surface-border)] bg-[var(--surface-subtle)] hover:border-[var(--surface-border-strong)]",
                )}
              >
                <p className="font-medium text-[var(--foreground)]">
                  {INCOME_PLAN_SCHEDULE_LABELS[option]}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card padding="lg">
          <CardHeader
            title="Paycheck details"
            description="Your typical take-home amount and pay timing."
          />
          <CardContent className="space-y-4">
            <FormField label="Average paycheck amount" htmlFor="paycheck-amount">
              <input
                id="paycheck-amount"
                type="number"
                min="0"
                step="0.01"
                value={paycheckAmount}
                onChange={(event) => setPaycheckAmount(event.target.value)}
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[#0077ed]"
                placeholder="880.66"
              />
            </FormField>

            <FormField label="Most recent pay date" htmlFor="anchor-date">
              <input
                id="anchor-date"
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[#0077ed]"
              />
            </FormField>

            {(paySchedule === "weekly" || paySchedule === "biweekly") && (
              <FormField label="Payday" htmlFor="payday">
                <select
                  id="payday"
                  value={weeklyDayOfWeek}
                  onChange={(event) =>
                    setWeeklyDayOfWeek(Number.parseInt(event.target.value, 10))
                  }
                  className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[#0077ed]"
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      Every {paySchedule === "biweekly" ? "other " : ""}
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {paySchedule === "twice_monthly" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="First pay day" htmlFor="monthly-day-1">
                  <input
                    id="monthly-day-1"
                    type="number"
                    min="1"
                    max="31"
                    value={monthlyDays[0] ?? 1}
                    onChange={(event) =>
                      setMonthlyDays([
                        Number.parseInt(event.target.value, 10) || 1,
                        monthlyDays[1] ?? 15,
                      ])
                    }
                    className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
                  />
                </FormField>
                <FormField label="Second pay day" htmlFor="monthly-day-2">
                  <input
                    id="monthly-day-2"
                    type="number"
                    min="1"
                    max="31"
                    value={monthlyDays[1] ?? 15}
                    onChange={(event) =>
                      setMonthlyDays([
                        monthlyDays[0] ?? 1,
                        Number.parseInt(event.target.value, 10) || 15,
                      ])
                    }
                    className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
                  />
                </FormField>
              </div>
            )}

            {paySchedule === "monthly" && (
              <FormField label="Pay day of month" htmlFor="monthly-day">
                <input
                  id="monthly-day"
                  type="number"
                  min="1"
                  max="31"
                  value={monthlyDays[0] ?? 1}
                  onChange={(event) =>
                    setMonthlyDays([Number.parseInt(event.target.value, 10) || 1])
                  }
                  className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
                />
              </FormField>
            )}

            {paySchedule === "custom" && (
              <FormField label="Days between paychecks" htmlFor="custom-interval">
                <input
                  id="custom-interval"
                  type="number"
                  min="1"
                  value={customIntervalDays}
                  onChange={(event) => setCustomIntervalDays(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
                />
              </FormField>
            )}

            <FormField label="Deposit account" htmlFor="deposit-account">
              <select
                id="deposit-account"
                value={depositAccountId ?? ""}
                onChange={(event) =>
                  setDepositAccountId(event.target.value || null)
                }
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
              >
                <option value="">Select account</option>
                {finance.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </FormField>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card padding="lg">
          <CardHeader
            title="Where should each paycheck go?"
            description="Enter a fixed dollar amount for each category, then mark one as Remaining Balance for what's left."
          />
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-[var(--text-muted)]">
                  Paycheck
                </span>
                <span className="text-lg font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(paycheckAmountValue)}
                </span>
              </div>
            </div>

            {allocations.map((allocation, index) => (
              <div
                key={index}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      value={allocation.icon}
                      onChange={(event) =>
                        updateAllocation(index, { icon: event.target.value })
                      }
                      aria-label={`Icon for ${allocation.name}`}
                      className="w-12 shrink-0 rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-2 py-2 text-center text-lg"
                      maxLength={2}
                    />
                    <input
                      value={allocation.name}
                      onChange={(event) =>
                        updateAllocation(index, { name: event.target.value })
                      }
                      placeholder="Category name"
                      className="min-w-0 flex-1 rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[#0077ed]"
                    />
                  </div>

                  {allocation.isRemainingBalance ? (
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:min-w-[9rem] sm:items-end">
                      <Badge variant="accent">Remaining Balance</Badge>
                      <span
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          allocationSummary.isOverAllocated
                            ? "text-red-500"
                            : "text-[var(--foreground)]",
                        )}
                      >
                        {formatCurrency(allocationSummary.remaining)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex shrink-0 flex-col gap-1 sm:min-w-[9rem] sm:items-end">
                      <span className="text-xs font-medium text-[var(--text-muted)]">
                        Fixed amount
                      </span>
                      <div className="relative w-full sm:w-36">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                          $
                        </span>
                        <input
                          inputMode="decimal"
                          value={amountInputs[index] ?? ""}
                          onChange={(event) =>
                            updateAmountInput(index, event.target.value)
                          }
                          placeholder="0"
                          aria-label={`Fixed amount for ${allocation.name}`}
                          className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background)] py-3 pl-8 pr-4 text-right tabular-nums text-[var(--foreground)] outline-none focus:border-[#0077ed]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <FormField label="Account">
                    <select
                      value={allocation.accountId ?? ""}
                      onChange={(event) =>
                        updateAllocation(index, {
                          accountId: event.target.value || null,
                        })
                      }
                      className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-4 py-3"
                    >
                      <option value="">None</option>
                      {finance.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Goal">
                    <select
                      value={allocation.goalId ?? ""}
                      onChange={(event) =>
                        updateAllocation(index, {
                          goalId: event.target.value || null,
                        })
                      }
                      className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-4 py-3"
                    >
                      <option value="">None</option>
                      {finance.savingsGoals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.icon} {goal.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={
                      allocation.isRemainingBalance ? "primary" : "secondary"
                    }
                    onClick={() => setRemainingBalance(index)}
                  >
                    {allocation.isRemainingBalance
                      ? "Remaining Balance"
                      : "Use as Remaining Balance"}
                  </Button>
                  {allocations.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAllocation(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button variant="secondary" onClick={addAllocation}>
              Add category
            </Button>

            <AllocationSummary
              paycheckAmount={paycheckAmountValue}
              allocations={parsedAllocations}
              className="mt-2"
            />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {step > 1 && (
          <Button variant="secondary" onClick={() => setStep((value) => (value - 1) as SetupStep)}>
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button onClick={() => setStep((value) => (value + 1) as SetupStep)}>
            Continue
          </Button>
        ) : (
          <Button
            disabled={
              isSaving ||
              finance.isSyncing ||
              allocationSummary.isOverAllocated ||
              allocationSummary.remainingBalanceCount !== 1 ||
              paycheckAmountValue <= 0
            }
            onClick={() => void handleSave()}
          >
            {isSaving ? "Saving…" : existing ? "Save changes" : "Finish setup"}
          </Button>
        )}
      </div>

      {finance.accounts.length === 0 && step >= 2 && (
        <EmptyState
          icon="🏦"
          title="Add an account first"
          description="Income Plans need a deposit account for paychecks."
          actionLabel="Go to accounts"
          onAction={() => {
            window.location.href = "/accounts";
          }}
        />
      )}
    </div>
  );
}
