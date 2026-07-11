"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OnboardingConfetti } from "@/components/onboarding/OnboardingConfetti";
import { OnboardingPlaidConnect } from "@/components/onboarding/OnboardingPlaidConnect";
import { Button, Card, Input, Select } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/finance/accountTypes";
import type { OnboardingProgress, OnboardingSetupPath } from "@/lib/onboarding/progress";
import {
  getOnboardingTotalSteps,
  MANUAL_ONBOARDING_TOTAL_STEPS,
} from "@/lib/onboarding/progress";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";
import { INCOME_PLAN_SCHEDULE_LABELS } from "@/lib/incomePlan/types";

const STEP_TIPS: Record<string, string> = {
  welcome: "You can pause anytime — your progress saves automatically.",
  setupChoice: "Choose the setup path that fits you. You can change this later.",
  paySchedule: "Your schedule powers paycheck predictions and Safe To Spend.",
  incomePlan: "Use your typical take-home pay, not gross income.",
  account: "Start with your primary checking account, or skip and connect Plaid later.",
  bill: "Recurring bills help forecast your monthly cash flow.",
  goal: "Even a small savings goal keeps you motivated.",
  household: "Household invites let partners collaborate on shared finances.",
  plaidConnect: "Plaid is the fastest way to import accounts, balances, and transactions.",
  health: "Your health score improves as you add more financial data.",
  finish: "You're ready to explore your personalized dashboard.",
};

const CHECKLIST_ITEMS: Array<{
  key: keyof OnboardingProgress;
  label: string;
}> = [
  { key: "paySchedule", label: "Paycheck schedule set" },
  { key: "paycheckAmount", label: "Income plan created" },
  { key: "accountName", label: "Account added" },
  { key: "billName", label: "Bill tracked" },
  { key: "goalName", label: "Savings goal created" },
];

const SCHEDULE_OPTIONS: IncomePlanSchedule[] = [
  "weekly",
  "biweekly",
  "twice_monthly",
  "monthly",
];

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs text-white/45">
        <span>
          Step {step} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Onboarding step ${step} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0077ed] to-[#4da3ff] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepTip({ tipKey }: { tipKey: string }) {
  const tip = STEP_TIPS[tipKey];

  if (!tip) {
    return null;
  }

  return (
    <p className="mb-6 rounded-2xl border border-[#0077ed]/15 bg-[#0077ed]/5 px-4 py-3 text-sm text-white/55">
      <span className="mr-1.5" aria-hidden>
        💡
      </span>
      {tip}
    </p>
  );
}

function SetupChoiceCard({
  title,
  description,
  bullets,
  selected,
  recommended,
  onClick,
}: {
  title: string;
  description: string;
  bullets: string[];
  selected: boolean;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-5 py-5 text-left transition-colors",
        selected
          ? "border-[#0077ed]/40 bg-[#0077ed]/10"
          : "border-white/[0.08] bg-white/[0.02] hover:border-[#0077ed]/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-white">{title}</p>
        {recommended ? (
          <span className="shrink-0 rounded-full bg-[#0077ed]/20 px-2.5 py-1 text-xs font-medium text-[#4da3ff]">
            Recommended
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-white/50">{description}</p>
      <ul className="mt-4 space-y-1.5 text-sm text-white/45">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </button>
  );
}

function SkipForNowButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button className="w-full sm:w-auto" variant="secondary" size="md" disabled={disabled} onClick={onClick}>
      Skip for Now
    </Button>
  );
}

export function GuidedOnboardingExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { addAccount, addBill, createGoal, saveIncomePlan, completeGuidedOnboarding, refreshFinance } =
    useFinance();
  const { inviteMember } = useHousehold();
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState<OnboardingProgress>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = getOnboardingTotalSteps(progress);
  const isPlaidPath = progress.setupPath === "plaid";
  const isManualPath = progress.setupPath === "manual";

  const persistProgress = useCallback(
    async (nextStep: number, nextProgress: OnboardingProgress) => {
      await fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep, progress: nextProgress }),
      });
    },
    [],
  );

  const goToStep = useCallback(
    async (nextStep: number, patch: Partial<OnboardingProgress> = {}) => {
      const nextProgress = { ...progress, ...patch };
      setProgress(nextProgress);
      setStep(nextStep);
      await persistProgress(nextStep, nextProgress);
    },
    [persistProgress, progress],
  );

  const loadProgress = useCallback(async () => {
    const response = await fetch("/api/onboarding/progress");
    if (!response.ok) return;
    const payload = (await response.json()) as {
      step?: number;
      progress?: OnboardingProgress;
    };
    if (payload.progress) setProgress(payload.progress);
    if (payload.step) setStep(payload.step);
  }, []);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    if (searchParams.get("plaid") !== "resume") {
      return;
    }

    void (async () => {
      await refreshFinance();
      if (progress.setupPath === "plaid" && step < 4) {
        await goToStep(4);
      }
    })();
  }, [goToStep, progress.setupPath, refreshFinance, searchParams, step]);

  const healthScore = useMemo(() => {
    let score = 42;
    if (progress.accountName) score += 15;
    if (progress.billName) score += 10;
    if (progress.goalName) score += 12;
    if (progress.paycheckAmount) score += 11;
    return Math.min(score, 82);
  }, [progress]);

  const finishOnboarding = useCallback(
    async (patch: Partial<OnboardingProgress> = {}) => {
      setIsSubmitting(true);

      try {
        const nextProgress = {
          ...progress,
          ...patch,
          showPlaidConnectBanner:
            patch.showPlaidConnectBanner ??
            progress.showPlaidConnectBanner ??
            (progress.setupPath === "plaid" ||
              patch.skippedManualAccounts === true ||
              progress.skippedManualAccounts === true),
        };

        await persistProgress(step, nextProgress);
        await completeGuidedOnboarding();
        trackEvent(
          ANALYTICS_EVENTS.COMPLETED_ONBOARDING,
          {
            steps_completed: step,
            setup_path: nextProgress.setupPath ?? "unknown",
            skipped_manual_accounts: Boolean(nextProgress.skippedManualAccounts),
          },
          { once: true, dedupeKey: `onboarding-${user?.id ?? "anon"}` },
        );
        router.push("/dashboard");
      } finally {
        setIsSubmitting(false);
      }
    },
    [completeGuidedOnboarding, persistProgress, progress, router, step, user?.id],
  );

  async function chooseSetupPath(setupPath: OnboardingSetupPath) {
    await goToStep(setupPath === "plaid" ? 3 : 3, { setupPath });
  }

  async function handleCreateIncomePlan() {
    if (!progress.paySchedule || !progress.paycheckAmount) return;

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await saveIncomePlan({
        paySchedule: progress.paySchedule,
        paycheckAmount: progress.paycheckAmount,
        anchorDate: today,
        weeklyDayOfWeek: 5,
        monthlyDays: [1, 15],
        customIntervalDays: null,
        depositAccountId: null,
        allocations: [
          {
            name: "Spending",
            icon: "💳",
            amount: null,
            isRemainingBalance: true,
            accountId: null,
            goalId: null,
            monthlyTarget: null,
            sortOrder: 0,
          },
        ],
      });
      trackEvent(ANALYTICS_EVENTS.CREATED_INCOME_PLAN, { source: "onboarding" });
      await goToStep(5);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateAccount() {
    if (!progress.accountName || !progress.accountType) return;

    setIsSubmitting(true);
    try {
      await addAccount({
        name: progress.accountName,
        institution: "Manual",
        type: progress.accountType as (typeof ACCOUNT_TYPE_OPTIONS)[number]["value"],
        balance: progress.accountBalance ?? 0,
      });
      trackEvent(ANALYTICS_EVENTS.ADDED_ACCOUNT, { source: "onboarding" });
      await goToStep(6, { skippedManualAccounts: false });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSkipAccountSetup() {
    await finishOnboarding({ skippedManualAccounts: true, showPlaidConnectBanner: true });
  }

  async function handleCreateBill() {
    if (!progress.billName || !progress.billAmount) return;

    setIsSubmitting(true);
    try {
      await addBill({
        name: progress.billName,
        amount: progress.billAmount,
        dueDay: progress.billDueDay ?? 1,
        autopay: false,
        recurring: true,
        category: "Bills",
      });
      trackEvent(ANALYTICS_EVENTS.ADDED_BILL, { source: "onboarding" });
      await goToStep(7);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateGoal() {
    if (!progress.goalName || !progress.goalTarget) return;

    setIsSubmitting(true);
    try {
      await createGoal({
        name: progress.goalName,
        type: "custom",
        current: 0,
        target: progress.goalTarget,
      });
      trackEvent(ANALYTICS_EVENTS.CREATED_GOAL, { source: "onboarding" });
      await goToStep(8);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePlaidConnected() {
    await finishOnboarding({ showPlaidConnectBanner: false });
  }

  async function handlePlaidSkipped() {
    await finishOnboarding({ showPlaidConnectBanner: true });
  }

  const tipKey = useMemo(() => {
    if (step === 1) return "welcome";
    if (step === 2) return "setupChoice";
    if (isPlaidPath) {
      if (step === 3) return "plaidConnect";
      return "finish";
    }
    if (step === 3) return "paySchedule";
    if (step === 4) return "incomePlan";
    if (step === 5) return "account";
    if (step === 6) return "bill";
    if (step === 7) return "goal";
    if (step === 8) return "household";
    if (step === 9) return "health";
    return "finish";
  }, [isPlaidPath, step]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0f1a] px-5 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))] font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,119,237,0.18),transparent)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-xl">
        <ProgressBar step={step} total={totalSteps} />
        <StepTip tipKey={tipKey} />

        {step === 1 && (
          <div className="onboarding-step-enter text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-2xl">
              💰
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome to Buxme</h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/50 sm:text-base">
              Let&apos;s set up your finances in a few guided steps. You can skip optional steps and
              resume anytime.
            </p>
            <Button className="mt-8" size="md" onClick={() => void goToStep(2)}>
              Get started
            </Button>
          </div>
        )}

        {step === 2 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">How would you like to get started?</h2>
            <p className="mt-2 text-sm text-white/45">
              Pick the setup path that works best for you. You can always connect Plaid or add manual
              accounts later.
            </p>
            <div className="mt-6 space-y-4">
              <SetupChoiceCard
                title="📱 Connect my bank"
                description="Uses Plaid"
                bullets={[
                  "Automatically imports accounts, balances, and transactions",
                  "Fastest setup",
                ]}
                selected={progress.setupPath === "plaid"}
                recommended
                onClick={() => void chooseSetupPath("plaid")}
              />
              <SetupChoiceCard
                title="✍️ Enter everything manually"
                description="Create accounts yourself"
                bullets={["Create accounts manually", "Track balances yourself"]}
                selected={progress.setupPath === "manual"}
                onClick={() => void chooseSetupPath("manual")}
              />
            </div>
          </Card>
        )}

        {isPlaidPath && step === 3 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">Connect your bank</h2>
            <p className="mt-2 text-sm text-white/45">
              Link your accounts with Plaid to import balances and transactions automatically.
            </p>
            <div className="mt-6">
              <OnboardingPlaidConnect
                isSubmitting={isSubmitting}
                onConnected={() => void handlePlaidConnected()}
                onSkip={() => void handlePlaidSkipped()}
              />
            </div>
          </Card>
        )}

        {isPlaidPath && step === 4 && (
          <>
            <OnboardingConfetti />
            <Card padding="lg" className="onboarding-step-enter text-center">
              <div className="success-pop mx-auto mb-4 text-4xl">🎉</div>
              <h2 className="text-2xl font-semibold">You&apos;re all set!</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm text-white/45">
                Your bank is connected. Explore your dashboard to review imported accounts and
                transactions.
              </p>
              <Button
                className="mt-8"
                size="md"
                disabled={isSubmitting}
                onClick={() => void finishOnboarding({ showPlaidConnectBanner: false })}
              >
                {isSubmitting ? "Finishing..." : "Go to dashboard"}
              </Button>
            </Card>
          </>
        )}

        {isManualPath && step === 3 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">Choose your paycheck schedule</h2>
            <p className="mt-2 text-sm text-white/45">This powers Income Plans and Safe To Spend.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SCHEDULE_OPTIONS.map((schedule) => (
                <button
                  key={schedule}
                  type="button"
                  onClick={() => void goToStep(4, { paySchedule: schedule })}
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition-colors",
                    progress.paySchedule === schedule
                      ? "border-[#0077ed]/40 bg-[#0077ed]/10"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-[#0077ed]/25",
                  )}
                >
                  <p className="text-sm font-medium">{INCOME_PLAN_SCHEDULE_LABELS[schedule]}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {isManualPath && step === 4 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">Create your first Income Plan</h2>
            <label className="mt-6 block text-sm">
              <span className="mb-2 block text-white/45">Typical paycheck amount</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={progress.paycheckAmount ?? ""}
                onChange={(event) =>
                  setProgress((current) => ({
                    ...current,
                    paycheckAmount: Number(event.target.value),
                  }))
                }
                placeholder="2500"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => void goToStep(3)}>
                Back
              </Button>
              <Button size="md" disabled={isSubmitting} onClick={() => void handleCreateIncomePlan()}>
                Continue
              </Button>
            </div>
          </Card>
        )}

        {isManualPath && step === 5 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">Add your first account</h2>
            <p className="mt-2 text-sm text-white/45">
              Enter a manual account, or skip and connect Plaid from your dashboard later.
            </p>
            <div className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block text-white/45">Account name</span>
                <Input
                  value={progress.accountName ?? ""}
                  onChange={(event) =>
                    setProgress((current) => ({ ...current, accountName: event.target.value }))
                  }
                  placeholder="Checking"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-white/45">Account type</span>
                <Select
                  value={progress.accountType ?? ""}
                  onChange={(event) =>
                    setProgress((current) => ({ ...current, accountType: event.target.value }))
                  }
                >
                  <option value="">Select type</option>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-white/45">Current balance</span>
                <Input
                  type="number"
                  value={progress.accountBalance ?? ""}
                  onChange={(event) =>
                    setProgress((current) => ({
                      ...current,
                      accountBalance: Number(event.target.value),
                    }))
                  }
                  placeholder="1200"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <SkipForNowButton
                disabled={isSubmitting}
                onClick={() => void handleSkipAccountSetup()}
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="md" onClick={() => void goToStep(4)}>
                  Back
                </Button>
                <Button size="md" disabled={isSubmitting} onClick={() => void handleCreateAccount()}>
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        )}

        {isManualPath && step === 6 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">Add your first bill</h2>
            <div className="mt-6 space-y-4">
              <Input
                value={progress.billName ?? ""}
                onChange={(event) =>
                  setProgress((current) => ({ ...current, billName: event.target.value }))
                }
                placeholder="Rent"
              />
              <Input
                type="number"
                value={progress.billAmount ?? ""}
                onChange={(event) =>
                  setProgress((current) => ({ ...current, billAmount: Number(event.target.value) }))
                }
                placeholder="1500"
              />
              <Input
                type="number"
                min="1"
                max="31"
                value={progress.billDueDay ?? ""}
                onChange={(event) =>
                  setProgress((current) => ({
                    ...current,
                    billDueDay: Number(event.target.value),
                  }))
                }
                placeholder="Due day (1-31)"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => void goToStep(5)}>
                Back
              </Button>
              <Button size="md" disabled={isSubmitting} onClick={() => void handleCreateBill()}>
                Continue
              </Button>
            </div>
          </Card>
        )}

        {isManualPath && step === 7 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">Create your first savings goal</h2>
            <div className="mt-6 space-y-4">
              <Input
                value={progress.goalName ?? ""}
                onChange={(event) =>
                  setProgress((current) => ({ ...current, goalName: event.target.value }))
                }
                placeholder="Emergency Fund"
              />
              <Input
                type="number"
                value={progress.goalTarget ?? ""}
                onChange={(event) =>
                  setProgress((current) => ({
                    ...current,
                    goalTarget: Number(event.target.value),
                  }))
                }
                placeholder="Target amount"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => void goToStep(6)}>
                Back
              </Button>
              <Button size="md" disabled={isSubmitting} onClick={() => void handleCreateGoal()}>
                Continue
              </Button>
            </div>
          </Card>
        )}

        {isManualPath && step === 8 && (
          <Card padding="lg" className="onboarding-step-enter">
            <h2 className="text-xl font-semibold">Invite your household</h2>
            <p className="mt-2 text-sm text-white/45">Optional — collaborate on shared finances.</p>
            <Input
              className="mt-6"
              type="email"
              value={progress.inviteEmail ?? ""}
              onChange={(event) =>
                setProgress((current) => ({ ...current, inviteEmail: event.target.value }))
              }
              placeholder="partner@email.com"
            />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => void goToStep(9)}>
                Skip
              </Button>
              <Button
                size="md"
                disabled={isSubmitting}
                onClick={() => {
                  void (async () => {
                    const email = progress.inviteEmail?.trim();
                    if (email) {
                      setIsSubmitting(true);
                      try {
                        await inviteMember(email);
                      } catch {
                        // Household invite is optional during onboarding.
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                    void goToStep(9);
                  })();
                }}
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {isManualPath && step === 9 && (
          <Card padding="lg" className="onboarding-step-enter text-center">
            <p className="text-sm text-[#4da3ff]">Financial Health</p>
            <p className="mt-4 text-5xl font-semibold tabular-nums">{healthScore}</p>
            <p className="mx-auto mt-4 max-w-sm text-sm text-white/45">
              Your score will improve as you track accounts, bills, goals, and income plans.
            </p>
            <Button className="mt-8" size="md" onClick={() => void goToStep(MANUAL_ONBOARDING_TOTAL_STEPS)}>
              Continue
            </Button>
          </Card>
        )}

        {isManualPath && step === MANUAL_ONBOARDING_TOTAL_STEPS && (
          <>
            <OnboardingConfetti />
            <Card padding="lg" className="onboarding-step-enter text-center">
              <div className="success-pop mx-auto mb-4 text-4xl">🎉</div>
              <h2 className="text-2xl font-semibold">You&apos;re all set!</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm text-white/45">
                Your Buxme workspace is ready. Explore your dashboard and keep building your plan.
              </p>

              <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
                {CHECKLIST_ITEMS.map((item) => {
                  const isComplete = Boolean(progress[item.key]);

                  return (
                    <li
                      key={item.label}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                        isComplete
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-white/[0.03] text-white/35",
                      )}
                    >
                      <span aria-hidden>{isComplete ? "✓" : "○"}</span>
                      <span>{item.label}</span>
                    </li>
                  );
                })}
              </ul>

              <Button
                className="mt-8"
                size="md"
                disabled={isSubmitting}
                onClick={() =>
                  void finishOnboarding({
                    showPlaidConnectBanner: !progress.accountName,
                  })
                }
              >
                {isSubmitting ? "Finishing..." : "Go to dashboard"}
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
