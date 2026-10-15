"use client";

import { useMemo, useState } from "react";
import {
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
import { PaycheckAllocationEditor } from "@/components/incomePlan/PaycheckAllocationEditor";
import { EnvelopeBalancesCard } from "@/components/incomePlan/EnvelopeBalancesCard";
import { MonthlyAllocationProgress, NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { PaycheckDetectedPromptList } from "@/components/incomePlan/PaycheckDetectedPrompt";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getAllocationType } from "@/lib/allocation/allocationEngine";
import type { AllocationType } from "@/lib/allocation/types";
import {
  allocationAmountInputValue,
  allocationPercentInputValue,
  applyAllocationInputs,
  getAllocationSummary,
  setAllocationModeOnDraft,
  suggestAllocationIcons,
  validateAllocations,
  type AllocationDraftFields,
} from "@/lib/incomePlan/allocations";
import { describePaySchedule } from "@/lib/incomePlan/payDates";
import {
  EXTRA_PAYCHECK_SUGGESTIONS,
  INCOME_PLAN_SCHEDULE_LABELS,
  WEEKDAY_LABELS,
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

type AllocationDraft = AllocationDraftFields;

function defaultAllocations(): AllocationDraft[] {
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
      name: "Vacation",
      icon: "✈️",
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
      sortOrder: 2,
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
      sortOrder: 3,
    },
  ];
}

export function IncomePlanContent({ embedded = false }: { embedded?: boolean }) {
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
    (existing?.allocations ?? defaultAllocations()).map(allocationAmountInputValue),
  );
  const [percentInputs, setPercentInputs] = useState<string[]>(() =>
    (existing?.allocations ?? defaultAllocations()).map(allocationPercentInputValue),
  );
  const [allocationsDirty, setAllocationsDirty] = useState(false);

  const paycheckAmountValue = Number.parseFloat(paycheckAmount) || 0;
  const usingSavedAllocations = Boolean(existing && !showSettings && !allocationsDirty);
  const editorAllocations = usingSavedAllocations
    ? existing!.allocations
    : allocations;
  const editorAmountInputs = usingSavedAllocations
    ? existing!.allocations.map(allocationAmountInputValue)
    : amountInputs;
  const editorPercentInputs = usingSavedAllocations
    ? existing!.allocations.map(allocationPercentInputValue)
    : percentInputs;
  const activePaycheckAmount =
    existing && !showSettings ? existing.paycheckAmount : paycheckAmountValue;
  const activePaySchedule =
    existing && !showSettings ? existing.paySchedule : paySchedule;
  const activeCustomIntervalDays =
    existing && !showSettings
      ? existing.customIntervalDays
      : Number.parseInt(customIntervalDays, 10) || null;

  const parsedAllocations = useMemo(
    () =>
      editorAllocations.map((item, index) =>
        applyAllocationInputs(
          item,
          editorAmountInputs[index] ?? "",
          editorPercentInputs[index] ?? "",
        ),
      ),
    [editorAllocations, editorAmountInputs, editorPercentInputs],
  );

  const allocationSummary = useMemo(
    () => getAllocationSummary(activePaycheckAmount, parsedAllocations),
    [parsedAllocations, activePaycheckAmount],
  );

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

  function currentDraft() {
    if (usingSavedAllocations && existing) {
      return {
        allocations: existing.allocations,
        amountInputs: existing.allocations.map(allocationAmountInputValue),
        percentInputs: existing.allocations.map(allocationPercentInputValue),
      };
    }

    return { allocations, amountInputs, percentInputs };
  }

  function commitDraft(
    nextAllocations: AllocationDraft[],
    nextAmounts: string[],
    nextPercents: string[],
  ) {
    setAllocations(nextAllocations);
    setAmountInputs(nextAmounts);
    setPercentInputs(nextPercents);
    setAllocationsDirty(true);
  }

  function hydrateSchedule(plan: NonNullable<typeof existing>) {
    setPaySchedule(plan.paySchedule);
    setPaycheckAmount(String(plan.paycheckAmount));
    setAnchorDate(plan.anchorDate);
    setWeeklyDayOfWeek(plan.weeklyDayOfWeek ?? new Date().getDay());
    setMonthlyDays(plan.monthlyDays);
    setCustomIntervalDays(String(plan.customIntervalDays ?? 14));
    setDepositAccountId(plan.depositAccountId);
  }

  function openSettings() {
    if (!existing) {
      return;
    }

    hydrateSchedule(existing);
    if (!allocationsDirty) {
      setAllocations(existing.allocations);
      setAmountInputs(existing.allocations.map(allocationAmountInputValue));
      setPercentInputs(existing.allocations.map(allocationPercentInputValue));
    }
    setShowSettings(true);
    setStep(1);
  }

  async function handleSave() {
    const keepSavedSchedule = Boolean(existing && !showSettings);
    const amount = keepSavedSchedule
      ? existing!.paycheckAmount
      : Number.parseFloat(paycheckAmount);

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

    const input: SaveIncomePlanInput = keepSavedSchedule
      ? {
          paySchedule: existing!.paySchedule,
          paycheckAmount: existing!.paycheckAmount,
          anchorDate: existing!.anchorDate,
          weeklyDayOfWeek: existing!.weeklyDayOfWeek,
          monthlyDays: existing!.monthlyDays,
          customIntervalDays: existing!.customIntervalDays,
          depositAccountId: existing!.depositAccountId,
          // Preserve ownership link across amount/frequency/allocation edits.
          // Omit when unset so save can singleton-resolve; never coerce to null.
          ...(existing!.linkedIncomeSourceId
            ? { linkedIncomeSourceId: existing!.linkedIncomeSourceId }
            : {}),
          allocations: normalizedAllocations,
        }
      : {
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
          ...(existing?.linkedIncomeSourceId
            ? { linkedIncomeSourceId: existing.linkedIncomeSourceId }
            : {}),
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
      setAllocationsDirty(false);
      setShowSettings(false);
      setStep(1);
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsSaving(false);
    }
  }

  function updateAmountInput(index: number, value: string) {
    const draft = currentDraft();
    commitDraft(
      draft.allocations,
      draft.amountInputs.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
      draft.percentInputs,
    );
  }

  function updatePercentInput(index: number, value: string) {
    const draft = currentDraft();
    commitDraft(
      draft.allocations,
      draft.amountInputs,
      draft.percentInputs.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  }

  function updateAllocation(index: number, patch: Partial<AllocationDraft>) {
    const draft = currentDraft();
    commitDraft(
      draft.allocations.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
      draft.amountInputs,
      draft.percentInputs,
    );
  }

  function assignGoal(index: number, goalId: string | null) {
    const draft = currentDraft();
    if (
      goalId &&
      draft.allocations.some(
        (item, itemIndex) => itemIndex !== index && item.goalId === goalId,
      )
    ) {
      const goal = finance.savingsGoals.find((item) => item.id === goalId);
      showToast({
        title: "Goal already added",
        subtitle: goal
          ? `Edit the ${goal.name} row to change that amount.`
          : "Edit the existing row to change that amount.",
      });
      return;
    }

    const goal = goalId
      ? finance.savingsGoals.find((item) => item.id === goalId)
      : null;
    const current = draft.allocations[index];
    const previousGoal = finance.savingsGoals.find(
      (item) => item.id === current?.goalId,
    );
    const shouldRename =
      !current?.name.trim() ||
      current.name === "New category" ||
      current.name === previousGoal?.name;

    updateAllocation(index, {
      goalId,
      ...(goal && shouldRename ? { name: goal.name, icon: goal.icon } : {}),
    });
  }

  function insertAllocation(next: AllocationDraft) {
    const draft = currentDraft();
    const remainingIndex = draft.allocations.findIndex(
      (item) => getAllocationType(item) === "remaining",
    );
    const index =
      remainingIndex === -1 ? draft.allocations.length : remainingIndex;
    commitDraft(
      [
        ...draft.allocations.slice(0, index),
        next,
        ...draft.allocations.slice(index),
      ],
      [
        ...draft.amountInputs.slice(0, index),
        "",
        ...draft.amountInputs.slice(index),
      ],
      [
        ...draft.percentInputs.slice(0, index),
        "",
        ...draft.percentInputs.slice(index),
      ],
    );
  }

  function addAllocation() {
    insertAllocation({
      name: "New category",
      icon: "💵",
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
    });
  }

  function addGoalAllocation(goalId: string) {
    const goal = finance.savingsGoals.find((item) => item.id === goalId);
    if (!goal) {
      return;
    }

    const draft = currentDraft();
    if (draft.allocations.some((item) => item.goalId === goalId)) {
      showToast({
        title: "Goal already added",
        subtitle: `Edit the ${goal.name} row to change that amount.`,
      });
      return;
    }

    insertAllocation({
      name: goal.name,
      icon: goal.icon,
      amount: null,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: null,
      goalId: goal.id,
      billId: null,
      debtId: null,
      investmentId: null,
      monthlyTarget: null,
      contributionFrequency: null,
      sortOrder: 0,
    });
  }

  function removeAllocation(index: number) {
    const draft = currentDraft();
    if (draft.allocations.length <= 1) {
      return;
    }

    commitDraft(
      draft.allocations.filter((_, itemIndex) => itemIndex !== index),
      draft.amountInputs.filter((_, itemIndex) => itemIndex !== index),
      draft.percentInputs.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function setAllocationMode(index: number, mode: AllocationType) {
    const draft = currentDraft();
    const nextAllocations = setAllocationModeOnDraft(
      draft.allocations,
      index,
      mode,
    );
    commitDraft(
      nextAllocations,
      draft.amountInputs.map((value, itemIndex) =>
        mode === "remaining" && itemIndex === index ? "" : value,
      ),
      draft.percentInputs.map((value, itemIndex) =>
        mode === "remaining" && itemIndex === index ? "" : value,
      ),
    );
  }

  const saveAllocationsDisabled =
    isSaving ||
    finance.isSyncing ||
    allocationSummary.isOverAllocated ||
    allocationSummary.remainingBalanceCount !== 1 ||
    allocationSummary.percentageTotal > 100 ||
    activePaycheckAmount <= 0;

  const allocationEditor = (
    <PaycheckAllocationEditor
      paycheckAmount={activePaycheckAmount}
      allocations={parsedAllocations}
      amountInputs={editorAmountInputs}
      percentInputs={editorPercentInputs}
      goals={finance.savingsGoals}
      accounts={finance.accounts.map((account) => ({
        id: account.id,
        name: account.name,
      }))}
      paySchedule={activePaySchedule}
      customIntervalDays={activeCustomIntervalDays}
      onAmountInput={updateAmountInput}
      onPercentInput={updatePercentInput}
      onUpdate={updateAllocation}
      onAssignGoal={assignGoal}
      onAddGoal={addGoalAllocation}
      onAddCategory={addAllocation}
      onRemove={removeAllocation}
      onSetMode={setAllocationMode}
    />
  );

  if (existing && !showSettings) {
    return (
      <div className={cn(!embedded && pageContainerWideClassName, "min-w-0 space-y-4")}>
        {!embedded ? (
          <PageHeader
            action={
              <Button variant="secondary" onClick={openSettings}>
                Edit plan
              </Button>
            }
          />
        ) : (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={openSettings}>
              Edit plan
            </Button>
          </div>
        )}

        <PaycheckDetectedPromptList />

        <p className="text-sm text-[var(--text-secondary)]">
          {describePaySchedule(existing)} · {formatCurrency(existing.paycheckAmount)} per paycheck
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <NextPaycheckCard />
          <MonthlyAllocationProgress />
        </div>

        <EnvelopeBalancesCard />

        <Card padding="lg">
          <CardHeader
            title="Paycheck allocations"
            description="Set what each paycheck contributes. Saved balances change only when you confirm the paycheck."
          />
          <CardContent className="space-y-4">
            {allocationEditor}
            <Button
              type="button"
              size="lg"
              disabled={saveAllocationsDisabled || !allocationsDirty}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving…" : "Save allocations"}
            </Button>
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
    <div className={cn(!embedded && pageContainerWideClassName, "min-w-0 space-y-4")}>
      <PageHeader
        action={
          existing ? (
            <Button
              variant="ghost"
              onClick={() => {
                setShowSettings(false);
                setAllocationsDirty(false);
              }}
            >
              Cancel
            </Button>
          ) : undefined
        }
      />

      <PaycheckDetectedPromptList />

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
              step >= value ? "bg-[var(--accent)]" : "bg-[var(--surface-border)]",
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
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
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
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                placeholder="880.66"
              />
            </FormField>

            <FormField label="Most recent pay date" htmlFor="anchor-date">
              <input
                id="anchor-date"
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
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
                  className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3 text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
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
            description="Add savings goals, set a dollar amount or percent, and leave one row for whatever is left."
          />
          <CardContent>{allocationEditor}</CardContent>
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
            disabled={saveAllocationsDisabled}
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
