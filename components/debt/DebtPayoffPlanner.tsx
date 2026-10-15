"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { calculateMonthlyIncome } from "@/lib/calculations/income";
import {
  EXTRA_DEBT_ALLOCATION_NAME,
  buildDebtOverview,
  buildDebtRecommendations,
  compareDebtStrategies,
  formatPayoffDuration,
  incomePlanAllocationsWithExtraDebt,
  monthlyAmountFromSchedule,
  plannedExtraDebtMonthly,
  projectDebtPayoff,
  type DebtPayoffMonth,
  type DebtPayoffResult,
  type PayoffStrategyKind,
} from "@/lib/finance/debtPayoff";
import {
  readSavedDebtStrategy,
  writeSavedDebtStrategy,
  type SavedDebtStrategy,
} from "@/lib/finance/debtStrategyStorage";
import { formatCurrency } from "@/lib/finance/format";
import { formatDebtFreeDate } from "@/lib/finance/debts";
import { getSafeToSpend } from "@/lib/finance/safeToSpend";
import { INCOME_PLAN_SCHEDULE_LABELS } from "@/lib/incomePlan/types";
import { cn } from "@/components/ui/cn";
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";

type DebtPayoffPlannerProps = {
  variant?: "web" | "ios";
};

function formatProjectedDate(result: DebtPayoffResult): string {
  if (!result.isReliable || !result.debtFreeDate) {
    return "Forecast incomplete";
  }
  return formatDebtFreeDate(result.debtFreeDate);
}

function withEarmark(
  base: Record<string, number>,
  extra: Record<string, number>,
): Record<string, number> {
  const next = { ...base };
  for (const [id, amount] of Object.entries(extra)) {
    next[id] = (next[id] ?? 0) + amount;
  }
  return next;
}

function downsample(schedule: DebtPayoffMonth[], count: number): DebtPayoffMonth[] {
  if (schedule.length <= count) {
    return schedule;
  }
  const points: DebtPayoffMonth[] = [];
  const step = (schedule.length - 1) / (count - 1);
  for (let index = 0; index < count; index += 1) {
    points.push(schedule[Math.round(index * step)]);
  }
  return points;
}

export function DebtPayoffPlanner({ variant = "web" }: DebtPayoffPlannerProps) {
  const finance = useFinance();
  const { user } = useAuth();
  const debts = finance.debts ?? [];
  const activeDebts = debts.filter((debt) => debt.balance > 0.009);
  const plan = finance.incomePlan;
  const savedAllocation = plan?.allocations.find(
    (allocation) => allocation.name === EXTRA_DEBT_ALLOCATION_NAME,
  );
  const [strategy, setStrategy] = useState<PayoffStrategyKind>("avalanche");
  const [extraMonthly, setExtraMonthly] = useState(0);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [extraByDebtId, setExtraByDebtId] = useState<Record<string, number>>({});
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [paycheckAmount, setPaycheckAmount] = useState(savedAllocation?.amount ?? 0);
  const [paycheckDebtId, setPaycheckDebtId] = useState<string | null>(
    savedAllocation?.debtId ?? null,
  );
  const paycheckEdited = useRef(false);
  const [saved, setSaved] = useState<SavedDebtStrategy | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  useEffect(() => {
    const stored = readSavedDebtStrategy(user?.id ?? null);
    if (stored) {
      setStrategy(stored.strategy);
      setExtraMonthly(stored.extraMonthly);
      setCustomOrder(stored.customOrder);
      setExtraByDebtId(stored.extraByDebtId);
      setMonthlyBudget(stored.monthlyBudget);
      setSaved(stored);
    }
    setHydrated(true);
  }, [user?.id]);

  useEffect(() => {
    if (paycheckEdited.current) {
      return;
    }
    setPaycheckAmount(savedAllocation?.amount ?? 0);
    setPaycheckDebtId(savedAllocation?.debtId ?? null);
  }, [savedAllocation?.amount, savedAllocation?.debtId]);

  const orderedIds = useMemo(() => {
    const known = new Set(activeDebts.map((debt) => debt.id));
    const next = customOrder.filter((id) => known.has(id));
    for (const debt of activeDebts) {
      if (!next.includes(debt.id)) {
        next.push(debt.id);
      }
    }
    return next;
  }, [activeDebts, customOrder]);

  const paycheckMonthly =
    plan && paycheckDebtId
      ? monthlyAmountFromSchedule(
          paycheckAmount,
          plan.paySchedule,
          plan.customIntervalDays,
        )
      : 0;
  const paycheckEarmark = useMemo(
    () => (paycheckDebtId && paycheckMonthly > 0 ? { [paycheckDebtId]: paycheckMonthly } : {}),
    [paycheckDebtId, paycheckMonthly],
  );
  const baseline = useMemo(
    () =>
      projectDebtPayoff({
        debts: activeDebts,
        strategy,
        extraMonthly: 0,
        customOrder: orderedIds,
        extraByDebtId:
          strategy === "custom" && monthlyBudget == null
            ? withEarmark(extraByDebtId, paycheckEarmark)
            : paycheckEarmark,
        monthlyBudget: strategy === "custom" ? monthlyBudget : null,
      }),
    [activeDebts, strategy, orderedIds, extraByDebtId, monthlyBudget, paycheckEarmark],
  );
  const comparison = useMemo(
    () =>
      compareDebtStrategies({
        debts: activeDebts,
        extraMonthly,
        customOrder: orderedIds,
        extraByDebtId: strategy === "custom" ? extraByDebtId : {},
        sharedExtraByDebtId: paycheckEarmark,
        monthlyBudget: strategy === "custom" ? monthlyBudget : null,
      }),
    [activeDebts, extraMonthly, orderedIds, strategy, extraByDebtId, monthlyBudget, paycheckEarmark],
  );
  const projected =
    strategy === "snowball"
      ? comparison.snowball
      : strategy === "custom"
        ? comparison.custom
        : comparison.avalanche;
  const overview = buildDebtOverview(activeDebts, projected);
  const minimums = overview.totalMinimum;
  const safeToSpend = getSafeToSpend(finance);
  const monthlyIncome = calculateMonthlyIncome(finance);
  const savedPaycheckMonthly = plannedExtraDebtMonthly(plan);
  const recommendations = buildDebtRecommendations({
    debts: activeDebts,
    comparison,
    extraMonthly: extraMonthly + Math.max(0, paycheckMonthly - savedPaycheckMonthly),
    safeToSpend,
    monthlyIncome,
  });
  const sliderMax = Math.max(500, Math.ceil(minimums / 50) * 50);
  const strategyDirty =
    !saved ||
    saved.strategy !== strategy ||
    saved.extraMonthly !== extraMonthly ||
    saved.monthlyBudget !== monthlyBudget ||
    saved.customOrder.join() !== orderedIds.join() ||
    JSON.stringify(saved.extraByDebtId) !== JSON.stringify(extraByDebtId);
  const paycheckDirty =
    (savedAllocation?.amount ?? 0) !== paycheckAmount ||
    (savedAllocation?.debtId ?? null) !== (paycheckAmount > 0 ? paycheckDebtId : null);
  const dirty = strategyDirty || paycheckDirty;

  async function saveStrategy() {
    if (!hydrated || saving) {
      return;
    }
    setSaving(true);
    setNotice(null);
    const nextSaved: SavedDebtStrategy = {
      strategy,
      extraMonthly,
      customOrder: orderedIds,
      extraByDebtId,
      monthlyBudget,
    };
    writeSavedDebtStrategy(user?.id ?? null, nextSaved);
    setSaved(nextSaved);
    try {
      if (paycheckDirty && plan) {
        await finance.saveIncomePlan({
          paySchedule: plan.paySchedule,
          paycheckAmount: plan.paycheckAmount,
          anchorDate: plan.anchorDate,
          weeklyDayOfWeek: plan.weeklyDayOfWeek,
          monthlyDays: plan.monthlyDays,
          customIntervalDays: plan.customIntervalDays,
          depositAccountId: plan.depositAccountId,
          ...(plan.linkedIncomeSourceId
            ? { linkedIncomeSourceId: plan.linkedIncomeSourceId }
            : {}),
          allocations: incomePlanAllocationsWithExtraDebt(plan.allocations, {
            amount: paycheckAmount,
            debtId: paycheckDebtId,
          }),
        });
        setNotice("Strategy saved. The paycheck extra is planned and no payment was recorded.");
      } else if (paycheckDirty && paycheckAmount > 0) {
        setNotice("Strategy saved on this device. Create a paycheck plan before attaching an extra payment.");
      } else {
        setNotice("Strategy saved. Balances and payments were not changed.");
      }
    } finally {
      setSaving(false);
    }
  }

  function moveDebt(id: string, direction: -1 | 1) {
    const index = orderedIds.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedIds.length) {
      return;
    }
    const next = [...orderedIds];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setCustomOrder(next);
  }

  if (activeDebts.length === 0) {
    return null;
  }

  const chartPoints = downsample(projected.schedule, 16);
  const maxBalance = Math.max(...chartPoints.map((month) => month.startingBalance), 1);

  return (
    <Card padding={variant === "ios" ? "compact" : "lg"} className="min-w-0" data-debt-payoff="">
      <div className="space-y-5">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">Projected</p>
          <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight text-[var(--foreground)]">
            {projected.timeLabel}
          </p>
          <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
            {projected.isReliable
              ? `Debt-free ${formatProjectedDate(projected)}`
              : "Forecast incomplete"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <OverviewStat label="Outstanding debt" value={formatCurrency(overview.totalBalance)} detail="Actual balance" />
          <OverviewStat label="Monthly minimums" value={formatCurrency(minimums)} detail="Actual payments" />
          <OverviewStat
            label="Weighted APR"
            value={overview.weightedApr == null ? "—" : `${overview.weightedApr}%`}
            detail="Actual rates"
          />
          <OverviewStat label="Active debts" value={String(overview.activeCount)} detail="Actual accounts" />
          <OverviewStat label="Debt-free date" value={formatProjectedDate(projected)} detail="Projected" />
          <OverviewStat label="Time remaining" value={formatPayoffDuration(projected.months)} detail="Projected" />
          <OverviewStat
            label="Projected interest"
            value={projected.totalInterest == null ? "Incomplete" : formatCurrency(projected.totalInterest)}
            detail="Projected"
          />
          <OverviewStat
            label="Total paid"
            value={projected.totalPaid == null ? "Incomplete" : formatCurrency(projected.totalPaid)}
            detail="Principal and interest"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <StrategyCard
            title="Debt snowball"
            body="Minimums on every debt, extra toward the smallest balance, then roll that payment forward."
            result={comparison.snowball}
            interestSaved={comparison.interestSaved.snowball}
            selected={strategy === "snowball"}
            onSelect={() => setStrategy("snowball")}
          />
          <StrategyCard
            title="Debt avalanche"
            body="Minimums on every debt, extra toward the highest APR, then roll that payment forward."
            result={comparison.avalanche}
            interestSaved={comparison.interestSaved.avalanche}
            selected={strategy === "avalanche"}
            recommended={comparison.recommended === "avalanche"}
            onSelect={() => setStrategy("avalanche")}
          />
          <StrategyCard
            title="Custom strategy"
            body="Choose the order, individual extras, or one monthly debt budget."
            result={comparison.custom}
            interestSaved={comparison.interestSaved.custom}
            selected={strategy === "custom"}
            onSelect={() => setStrategy("custom")}
          />
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {comparison.recommendation}
        </p>

        <div className="rounded-2xl border border-white/[0.06] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] text-[var(--text-secondary)]">Current monthly payment</p>
              <p className="text-[20px] font-semibold tabular-nums">
                {formatCurrency(baseline.monthlyCommitment)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-[var(--text-secondary)]">New monthly payment</p>
              <p className="text-[20px] font-semibold tabular-nums">
                {formatCurrency(projected.monthlyCommitment)}
              </p>
            </div>
          </div>
          <label className="mt-4 block text-[13px] text-[var(--text-secondary)]" htmlFor="debt-extra-slider">
            Extra monthly payment: {formatCurrency(extraMonthly)}
          </label>
          <input
            id="debt-extra-slider"
            className="mt-2 w-full accent-[var(--accent)]"
            type="range"
            min={0}
            max={sliderMax}
            step={10}
            value={Math.min(extraMonthly, sliderMax)}
            onChange={(event) => setExtraMonthly(Number(event.target.value))}
          />
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            {baseline.isReliable && projected.isReliable && baseline.months != null && projected.months != null
              ? `${baseline.months - projected.months > 0 ? `${formatPayoffDuration(baseline.months - projected.months)} sooner.` : "Same payoff date as the plan without this extra."} Interest saved ${formatCurrency(Math.max(0, (baseline.totalInterest ?? 0) - (projected.totalInterest ?? 0)))}.`
              : "Move the slider to preview a larger payment. Nothing is saved until you choose Save strategy."}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            The slider only previews the plan. It does not change a payment or a balance.
          </p>
        </div>

        {strategy === "custom" ? (
          <div className="space-y-3">
            <p className="text-[15px] font-semibold">Custom order and extras</p>
            {orderedIds.map((id, index) => {
              const debt = activeDebts.find((item) => item.id === id);
              if (!debt) return null;
              return (
                <div key={id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {index + 1}. {debt.name}
                  </span>
                  <input
                    aria-label={`Extra for ${debt.name}`}
                    className="min-h-11 w-28 rounded-xl border border-white/10 bg-transparent px-3 text-base"
                    inputMode="decimal"
                    value={extraByDebtId[id] ?? ""}
                    onChange={(event) => {
                      const amount = Number.parseFloat(event.target.value);
                      setExtraByDebtId((current) => ({
                        ...current,
                        [id]: Number.isFinite(amount) ? Math.max(0, amount) : 0,
                      }));
                    }}
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={() => moveDebt(id, -1)}>
                    Up
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => moveDebt(id, 1)}>
                    Down
                  </Button>
                </div>
              );
            })}
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              A custom budget replaces the slider and per-debt extras. A paycheck extra is still added on top and goes to the debt you choose.
            </p>
            <label className="block text-[13px] text-[var(--text-secondary)]">
              Custom total monthly debt budget
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-transparent px-3 text-base"
                inputMode="decimal"
                value={monthlyBudget ?? ""}
                onChange={(event) => {
                  if (!event.target.value.trim()) {
                    setMonthlyBudget(null);
                    return;
                  }
                  const amount = Number.parseFloat(event.target.value);
                  setMonthlyBudget(Number.isFinite(amount) ? Math.max(0, amount) : null);
                }}
              />
            </label>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-[15px] font-semibold">Paycheck extra</p>
          {plan ? (
            <>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {INCOME_PLAN_SCHEDULE_LABELS[plan.paySchedule]}. This amount is per paycheck and is added to the projection above.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Extra debt payment per paycheck"
                  className="min-h-11 flex-1 rounded-xl border border-white/10 bg-transparent px-3 text-base"
                  inputMode="decimal"
                  value={paycheckAmount || ""}
                  onChange={(event) => {
                    paycheckEdited.current = true;
                    const amount = Number.parseFloat(event.target.value);
                    setPaycheckAmount(Number.isFinite(amount) ? Math.max(0, amount) : 0);
                  }}
                />
                <select
                  aria-label="Debt that receives the paycheck extra"
                  className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[var(--background)] px-3 text-base"
                  value={paycheckDebtId ?? ""}
                  onChange={(event) => {
                    paycheckEdited.current = true;
                    setPaycheckDebtId(event.target.value || null);
                  }}
                >
                  <option value="">Choose a debt</option>
                  {activeDebts.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-[var(--text-secondary)]">
              Create a paycheck plan before allocating part of each paycheck to a debt.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[15px] font-semibold">Each debt</p>
          {activeDebts.map((debt) => {
            const payoffMonth = projected.payoffMonthByDebtId[debt.id];
            const base = Math.max(debt.originalBalance, debt.balance, 1);
            const paid = Math.max(0, Math.min(100, ((base - debt.balance) / base) * 100));
            return (
              <div key={debt.id}>
                <div className="mb-1 flex justify-between gap-3 text-[12px] text-[var(--text-secondary)]">
                  <span className="truncate">{debt.name}</span>
                  <span>{payoffMonth == null ? "No payoff date" : `Payoff month ${payoffMonth}`}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${paid}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <PayoffChart points={chartPoints} maxBalance={maxBalance} />
        <InterestSplit result={projected} />
        <StrategyBars snowball={comparison.snowball} avalanche={comparison.avalanche} />
        <ExtraSavings baseline={baseline} projected={projected} />

        <div>
          <p className="text-[15px] font-semibold">Payoff order</p>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {projected.order.map((item) => item.name).join(" → ") || "No active debts"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {projected.milestones.map((milestone) => (
            <div key={milestone.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
              <p className="text-[12px] text-[var(--text-secondary)]">{milestone.label}</p>
              <p className="text-[14px] font-semibold">
                {milestone.monthIndex == null ? "—" : `Month ${milestone.monthIndex}`}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[15px] font-semibold">Month-by-month schedule</p>
          {projected.schedule.slice(0, 18).map((month) => (
            <details key={month.index} className="rounded-xl border border-white/[0.06] px-3 py-2">
              <summary className="cursor-pointer text-[14px] font-medium">
                {month.label} · balance {formatCurrency(month.endingBalance)}
                {month.extraDebtName ? ` · extra to ${month.extraDebtName}` : ""}
              </summary>
              <MonthLines month={month} />
            </details>
          ))}
          {projected.schedule.length > 18 ? (
            <button
              type="button"
              className="min-h-11 text-[14px] font-semibold text-[var(--accent)]"
              onClick={() => setOpenMonth(projected.schedule[18]?.index ?? null)}
            >
              Later months
            </button>
          ) : null}
        </div>

        {recommendations.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[15px] font-semibold">Recommendations</p>
            {recommendations.map((item) => (
              <div key={item.id} className="rounded-xl bg-white/[0.03] px-3 py-3">
                <p className="text-[14px] font-semibold">{item.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{item.detail}</p>
              </div>
            ))}
          </div>
        ) : null}

        {projected.assumptions.map((assumption) => (
          <p key={assumption} className="text-[12px] leading-relaxed text-[var(--text-muted)]">
            {assumption}
          </p>
        ))}
        {projected.incompleteReason ? (
          <p className="text-[13px] font-medium text-[var(--danger)]">{projected.incompleteReason}</p>
        ) : null}
        {notice ? <p className="text-[13px] text-[var(--text-secondary)]">{notice}</p> : null}

        <div
          className={cn(
            "sticky bottom-0 z-10 -mx-1 bg-[var(--background)]/95 py-3",
            variant === "ios" && "pb-[calc(env(safe-area-inset-bottom)+12px)]",
          )}
        >
          <Button type="button" size="lg" fullWidth disabled={!dirty || saving} onClick={() => void saveStrategy()}>
            {saving ? "Saving…" : "Save strategy"}
          </Button>
        </div>
      </div>
      <IosBottomSheet
        open={openMonth != null}
        title="Later months"
        onClose={() => setOpenMonth(null)}
      >
        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {projected.schedule.slice(18, 36).map((month) => (
            <div key={month.index}>
              <p className="text-[14px] font-semibold">{month.label}</p>
              <MonthLines month={month} />
            </div>
          ))}
        </div>
      </IosBottomSheet>
    </Card>
  );
}

function OverviewStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.03] px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 truncate text-[16px] font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function StrategyCard({
  title,
  body,
  result,
  selected,
  recommended,
  interestSaved,
  onSelect,
}: {
  title: string;
  body: string;
  result: DebtPayoffResult;
  selected: boolean;
  recommended?: boolean;
  interestSaved?: number | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-2xl border px-3 py-3 text-left",
        selected ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/[0.06]",
      )}
    >
      <span className="block text-[15px] font-semibold text-[var(--foreground)]">{title}</span>
      {recommended ? (
        <span className="mt-1 block text-[12px] font-medium text-[var(--accent)]">Lowest interest</span>
      ) : null}
      <span className="mt-1 block text-[12px] leading-relaxed text-[var(--text-secondary)]">{body}</span>
      <span className="mt-3 block text-[13px] text-[var(--foreground)]">
        {formatProjectedDate(result)} · {result.timeLabel}
      </span>
      <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
        Interest {result.totalInterest == null ? "incomplete" : formatCurrency(result.totalInterest)}
        {interestSaved == null ? "" : ` · saved ${formatCurrency(interestSaved)}`}
        {" · "}
        {formatCurrency(result.monthlyCommitment)} / month
      </span>
      <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
        {result.order.map((item) => item.name).join(" → ") || "No payoff order"}
      </span>
    </button>
  );
}

function MonthLines({ month }: { month: DebtPayoffMonth }) {
  return (
    <div className="mt-2 space-y-2">
      {month.lines.map((line) => (
        <div key={line.debtId} className="text-[12px] text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--foreground)]">
            {line.name}
            {line.receivesExtra ? " · receives extra" : ""}
          </p>
          <p>
            Start {formatCurrency(line.startingBalance)} · minimum {formatCurrency(line.minimumPayment)} · extra{" "}
            {formatCurrency(line.extraPayment)} · principal {formatCurrency(line.principalPaid)} · interest{" "}
            {formatCurrency(line.interestCharged)} · end {formatCurrency(line.endingBalance)}
          </p>
        </div>
      ))}
    </div>
  );
}

function PayoffChart({ points, maxBalance }: { points: DebtPayoffMonth[]; maxBalance: number }) {
  if (points.length === 0) {
    return null;
  }
  const width = 300;
  const height = 96;
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? width : (index / (points.length - 1)) * width;
      const y = height - (point.startingBalance / maxBalance) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div>
      <p className="text-[15px] font-semibold">Balance over time</p>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projected debt balance over time" className="mt-2 h-28 w-full">
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" />
      </svg>
    </div>
  );
}

function InterestSplit({ result }: { result: DebtPayoffResult }) {
  if (result.totalInterest == null || result.totalPaid == null) {
    return null;
  }
  const principal = Math.max(0, result.totalPaid - result.totalInterest);
  const total = Math.max(result.totalPaid, 1);
  return (
    <div>
      <p className="text-[15px] font-semibold">Principal versus interest</p>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-[var(--accent)]" style={{ width: `${(principal / total) * 100}%` }} />
        <div className="h-full bg-[var(--accent-light,#93c5fd)]" style={{ width: `${(result.totalInterest / total) * 100}%` }} />
      </div>
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
        Principal {formatCurrency(principal)} · interest {formatCurrency(result.totalInterest)}
      </p>
    </div>
  );
}

function StrategyBars({
  snowball,
  avalanche,
}: {
  snowball: DebtPayoffResult;
  avalanche: DebtPayoffResult;
}) {
  const left = snowball.totalInterest;
  const right = avalanche.totalInterest;
  if (left == null || right == null) {
    return null;
  }
  const max = Math.max(left, right, 1);
  return (
    <div>
      <p className="text-[15px] font-semibold">Snowball versus avalanche interest</p>
      <Bar label="Snowball" value={left} max={max} />
      <Bar label="Avalanche" value={right} max={max} />
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
        Extra-payment interest saved versus minimums is included in the comparison above.
      </p>
    </div>
  );
}

function ExtraSavings({
  baseline,
  projected,
}: {
  baseline: DebtPayoffResult;
  projected: DebtPayoffResult;
}) {
  if (
    !baseline.isReliable ||
    !projected.isReliable ||
    baseline.totalInterest == null ||
    projected.totalInterest == null
  ) {
    return null;
  }
  const saved = Math.max(0, baseline.totalInterest - projected.totalInterest);
  const max = Math.max(baseline.totalInterest, projected.totalInterest, 1);
  return (
    <div>
      <p className="text-[15px] font-semibold">Interest saved by the extra payment</p>
      <Bar label="Without the slider extra" value={baseline.totalInterest} max={max} />
      <Bar label="With the slider extra" value={projected.totalInterest} max={max} />
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
        Estimated interest saved {formatCurrency(saved)}. The paycheck allocation stays in both figures.
      </p>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-[12px] text-[var(--text-secondary)]">
        <span>{label}</span>
        <span>{formatCurrency(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}
