"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";
import { getDemoFinanceData } from "@/lib/demo/data";
import { computeFinanceHub } from "@/lib/finance/computeFinanceHub";
import { coerceFinanceData, emptyFinanceData } from "@/lib/finance/emptyFinanceData";
import {
  applyBillSplitPaymentByIdToData,
  applyDebtPaymentToData,
  applyGoalContributionToData,
} from "@/lib/finance/balanceEffects";
import { buildUpdatedDebt } from "@/lib/finance/debts";
import { buildUpdatedBill } from "@/lib/finance/bills";
import { buildUpdatedIncomeSource } from "@/lib/finance/income";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";
import type {
  AddAccountInput,
  AddBillInput,
  AddDebtInput,
  AddIncomeInput,
  AddMoneyToGoalInput,
  AddSavingsGoalInput,
  AddTransactionInput,
  CreateGoalInput,
  DashboardData,
  EditBillInput,
  EditDebtInput,
  EditGoalInput,
  EditIncomeInput,
  EditTransactionInput,
  FinanceData,
  MarkPaycheckReceivedInput,
  SaveIncomePlanInput,
} from "@/lib/finance/types";
import type { ActivityItem, FinanceEvent, NotificationItem } from "@/lib/events/types";
import {
  appendEvents,
  buildAccountAddedEvent,
  buildActivityAppliedEvent,
  buildBillAddedEvent,
  buildBillPaidEvent,
  buildDebtAddedEvent,
  buildDebtPaymentEvent,
  buildGoalContributionEvent,
  buildGoalCreatedEvent,
  buildIncomeAddedEvent,
  buildPaycheckProcessedEvent,
  buildTransactionAddedEvent,
  deriveEvents,
  markAllEventsRead,
  markEventRead,
} from "@/lib/events";
import { normalizePaycheckAssignment } from "@/lib/finance/paycheckSplit";
import { applyIncomePlanPaycheckToData } from "@/lib/incomePlan/applyPaycheck";
import {
  computeAutomationSuggestions,
  dismissAutomationSuggestion as persistDismissedAutomationSuggestion,
  getDismissedAutomationIds,
} from "@/lib/automation";
import { mergeAutomationNotifications } from "@/lib/automation/notifications";
import type { AutomationSuggestion } from "@/lib/automation/types";
import { registerAutomationProvider } from "@/lib/automation/registry";
import { plaidAutomationProvider } from "@/lib/automation/providers/plaidAutomationProvider";
import { configureIncomePlanPlaidDataAccessor } from "@/lib/incomePlan/plaidService";
import {
  disconnectPlaidBank,
  dismissPlaidRecurringSuggestion,
  fetchPlaidLinkToken,
  syncPlaidBank,
} from "@/lib/plaid/clientApi";
import { normalizeBillCategory } from "@/lib/finance/billCategories";
import type { DemoProfileId, OnboardingMode, OnboardingState } from "@/lib/onboarding/types";
import {
  createDemoOnboardingState,
  createFreshOnboardingState,
} from "@/lib/onboarding/demoMode";
import { isUserInDemoMode } from "@/lib/finance/demoData";
import {
  applyActivityToData,
  applyAllActivitiesToData,
  generateTodayActivity,
  normalizeRecurringFinanceData,
} from "@/lib/recurring";
import { getIncomeFrequencyLabel } from "@/lib/recurring/frequencies";
import type { TodayActivity } from "@/lib/recurring/types";
import {
  addTransactionToData,
  buildTransactionFromInput,
  buildUpdatedTransaction,
  removeTransactionFromData,
  updateTransactionInData,
} from "@/lib/transactions";
import {
  FinanceService,
  getErrorMessage,
  getSupabaseClient,
  getSupabaseConfig,
} from "@/lib/supabase";

type FinanceRepositoryLike = FinanceService;

function applyOnboardingState(
  state: OnboardingState,
  setters: {
    setOnboardingComplete: (value: boolean) => void;
    setOnboardingMode: (value: OnboardingMode | null) => void;
    setDemoProfileId: (value: DemoProfileId | null) => void;
  },
) {
  setters.setOnboardingComplete(state.complete);
  setters.setOnboardingMode(state.mode);
  setters.setDemoProfileId(state.demoProfileId);
}

export type FinanceContextValue = FinanceData & {
  dashboard: DashboardData;
  recentActivity: ActivityItem[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  onboardingComplete: boolean;
  onboardingMode: OnboardingMode | null;
  demoProfileId: DemoProfileId | null;
  isDemoMode: boolean;
  refreshFinance: () => Promise<void>;
  completeOnboarding: (
    mode: OnboardingMode,
    demoProfileId?: DemoProfileId,
  ) => Promise<void>;
  switchDemoProfile: (demoProfileId: DemoProfileId) => Promise<void>;
  exitDemoMode: () => Promise<void>;
  addAccount: (input: AddAccountInput) => Promise<void>;
  addIncome: (input: AddIncomeInput) => Promise<void>;
  editIncome: (incomeId: string, input: EditIncomeInput) => Promise<void>;
  deleteIncome: (incomeId: string) => Promise<void>;
  pauseIncome: (incomeId: string) => Promise<void>;
  resumeIncome: (incomeId: string) => Promise<void>;
  markIncomeReceived: (incomeId: string) => Promise<void>;
  addDebt: (input: AddDebtInput) => Promise<void>;
  editDebt: (debtId: string, input: EditDebtInput) => Promise<void>;
  deleteDebt: (debtId: string) => Promise<void>;
  makeDebtPayment: (debtId: string, amount: number) => Promise<void>;
  addBill: (input: AddBillInput) => Promise<void>;
  editBill: (billId: string, input: EditBillInput) => Promise<void>;
  deleteBill: (billId: string) => Promise<void>;
  markBillPaid: (billId: string) => Promise<void>;
  markBillSplitPaid: (
    billId: string,
    splitId: string,
    paymentAmount?: number,
  ) => Promise<void>;
  createGoal: (input: CreateGoalInput) => Promise<void>;
  addSavingsGoal: (input: AddSavingsGoalInput) => Promise<void>;
  editGoal: (goalId: string, input: EditGoalInput) => Promise<void>;
  addMoneyToGoal: (input: AddMoneyToGoalInput) => Promise<void>;
  applyTodayActivity: (activityId: string) => Promise<void>;
  applyAllTodayActivity: () => Promise<void>;
  addTransaction: (input: AddTransactionInput) => Promise<void>;
  editTransaction: (
    transactionId: string,
    input: EditTransactionInput,
  ) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  saveIncomePlan: (input: SaveIncomePlanInput) => Promise<void>;
  markIncomePlanPaycheckReceived: (
    input?: MarkPaycheckReceivedInput,
  ) => Promise<void>;
  runIncomePlan: (input?: MarkPaycheckReceivedInput) => Promise<void>;
  automationSuggestions: AutomationSuggestion[];
  dismissAutomationSuggestion: (suggestionId: string) => void;
  dismissAutomationSuggestionPermanently: (
    suggestion: AutomationSuggestion,
  ) => Promise<void>;
  completeAutomationSuggestion: (
    suggestion: AutomationSuggestion,
  ) => Promise<void>;
  connectBank: () => Promise<string>;
  reconnectBank: (connectionId: string) => Promise<string>;
  syncBank: (connectionId?: string) => Promise<void>;
  disconnectBank: (connectionId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
};

type RunMutationOptions = {
  events?: FinanceEvent[];
};

function buildEventsForTodayActivity(
  activity: TodayActivity,
  data: FinanceData,
): FinanceEvent[] {
  if (activity.entityType === "income") {
    const income = data.income.find((item) => item.id === activity.entityId);
    const frequencyLabel = income
      ? getIncomeFrequencyLabel(income.frequency)
      : "";
    const paycheckName = income
      ? `${frequencyLabel} ${income.name}`.trim()
      : activity.label.replace(/ Ready$/, "");

    return [buildPaycheckProcessedEvent(paycheckName, activity.amount)];
  }

  if (activity.entityType === "bill") {
    const bill = data.bills.find((item) => item.id === activity.entityId);

    if (bill) {
      return [buildBillPaidEvent(bill.name, bill.amount, bill.id)];
    }
  }

  if (activity.entityType === "goal") {
    const goal = data.savingsGoals.find((item) => item.id === activity.entityId);

    if (goal) {
      return [
        buildGoalContributionEvent(goal.name, activity.amount, goal.id),
      ];
    }
  }

  return [buildActivityAppliedEvent(activity.label)];
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

type FinanceProviderProps = {
  children: ReactNode;
};

export function FinanceProvider({ children }: FinanceProviderProps) {
  const { showToast } = useToast();
  const {
    user: authUser,
    isLoading: authLoading,
    isConfigured: authConfigured,
  } = useAuth();
  const [data, setData] = useState<FinanceData>(emptyFinanceData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode | null>(
    null,
  );
  const [demoProfileId, setDemoProfileId] = useState<DemoProfileId | null>(
    null,
  );
  const [automationDismissRevision, setAutomationDismissRevision] = useState(0);
  const repositoryRef = useRef<FinanceService | null>(null);
  const userIdRef = useRef<string | null>(null);
  const dataRef = useRef<FinanceData>(emptyFinanceData);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    registerAutomationProvider(plaidAutomationProvider);
    configureIncomePlanPlaidDataAccessor(() => dataRef.current);
  }, []);

  const dismissedAutomationIds = useMemo(() => {
    void automationDismissRevision;
    return getDismissedAutomationIds();
  }, [automationDismissRevision]);

  const automationSuggestions = useMemo(
    () => computeAutomationSuggestions(data, dismissedAutomationIds),
    [data, dismissedAutomationIds],
  );

  const refreshFinance = useCallback(async () => {
    const repository = repositoryRef.current;
    const userId = userIdRef.current;

    if (!repository || !userId) {
      return;
    }

    const next = await repository.loadFinanceData(userId);
    setData(coerceFinanceData(next));
  }, []);

  const { household } = useHousehold();

  useEffect(() => {
    const householdId = household?.id;

    if (!householdId || !getSupabaseConfig().isConfigured) {
      return;
    }

    const supabase = getSupabaseClient();
    const channel = supabase.channel(`household-finance-${householdId}`);
    const tables = [
      "accounts",
      "bills",
      "goals",
      "transactions",
      "investments",
      "income_plans",
      "income_plan_paycheck_events",
      "bank_connections",
    ] as const;

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void refreshFinance();
        },
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [household?.id, refreshFinance]);

  useEffect(() => {
    let cancelled = false;

    async function initializeFinance() {
      if (!getSupabaseConfig().isConfigured) {
        if (!cancelled) {
          setData(emptyFinanceData);
          setError(
            "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
          );
          setIsLoading(false);
          repositoryRef.current = null;
          userIdRef.current = null;
        }
        return;
      }

      if (authConfigured && authLoading) {
        return;
      }

      if (authConfigured && !authUser) {
        if (!cancelled) {
          setData(emptyFinanceData);
          setIsLoading(false);
          setError(null);
          setOnboardingComplete(false);
          setOnboardingMode(null);
          setDemoProfileId(null);
          repositoryRef.current = null;
          userIdRef.current = null;
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      setData(emptyFinanceData);
      setOnboardingComplete(false);
      setOnboardingMode(null);
      setDemoProfileId(null);
      repositoryRef.current = null;
      userIdRef.current = null;

      try {
        const supabase = getSupabaseClient();
        const repository = new FinanceService(supabase);
        const userId = await repository.getUserId();
        const [next, onboarding] = await Promise.all([
          repository.loadFinanceData(userId),
          repository.loadOnboardingState(userId),
        ]);

        if (cancelled) {
          return;
        }

        repositoryRef.current = repository;
        userIdRef.current = userId;
        applyOnboardingState(onboarding, {
          setOnboardingComplete,
          setOnboardingMode,
          setDemoProfileId,
        });
        setData(coerceFinanceData(next));
      } catch (loadError) {
        if (!cancelled) {
          setData(emptyFinanceData);
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initializeFinance();

    return () => {
      cancelled = true;
    };
  }, [authConfigured, authLoading, authUser?.id]);

  const runMutation = useCallback(
    async (
      optimisticNext: FinanceData,
      mutation: (
        repository: FinanceRepositoryLike,
        userId: string,
      ) => Promise<FinanceData>,
      options?: RunMutationOptions,
    ) => {
      const repository = repositoryRef.current;
      const userId = userIdRef.current;

      if (!repository || !userId) {
        const message = error ?? "Finance data is not ready yet.";
        showToast({ title: "Unable to save", subtitle: message, type: "error" });
        throw new Error(message);
      }

      const snapshot = dataRef.current;
      const derivedEvents = deriveEvents(snapshot, optimisticNext);
      const withEvents = appendEvents(optimisticNext, [
        ...(options?.events ?? []),
        ...derivedEvents,
      ]);

      setData(coerceFinanceData(withEvents));
      setError(null);
      setIsSyncing(true);

      try {
        const next = await mutation(repository, userId);

        await repository.saveEvents(userId, withEvents.events);

        setData(coerceFinanceData({ ...next, events: withEvents.events }));
      } catch (mutationError) {
        setData(snapshot);
        const message = getErrorMessage(mutationError);
        setError(message);
        showToast({ title: "Sync failed", subtitle: message, type: "error" });
        throw mutationError;
      } finally {
        setIsSyncing(false);
      }
    },
    [error, showToast],
  );

  const markNotificationRead = useCallback((notificationId: string) => {
    setData((previous) => {
      const next = markEventRead(previous, notificationId);
      const repository = repositoryRef.current;
      const userId = userIdRef.current;

      if (repository && userId) {
        void repository.markNotificationRead(userId, notificationId);
      }

      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setData((previous) => {
      const next = markAllEventsRead(previous);
      const repository = repositoryRef.current;
      const userId = userIdRef.current;

      if (repository && userId) {
        void repository.markAllNotificationsRead(userId);
      }

      return next;
    });
  }, []);

  const completeOnboarding = useCallback(
    async (mode: OnboardingMode, profileId?: DemoProfileId) => {
      const repository = repositoryRef.current;
      const userId = userIdRef.current;

      if (!repository || !userId) {
        const message = error ?? "Finance data is not ready yet.";
        showToast({ title: "Unable to continue", subtitle: message, type: "error" });
        throw new Error(message);
      }

      if (mode === "demo" && !profileId) {
        showToast({
          title: "Choose a demo profile",
          subtitle: "Select a sample profile to explore demo mode.",
        });
        throw new Error("Demo profile is required for demo mode.");
      }

      const nextData =
        mode === "demo" && profileId
          ? getDemoFinanceData(profileId)
          : emptyFinanceData;
      const onboardingState: OnboardingState =
        mode === "demo" && profileId
          ? createDemoOnboardingState(profileId)
          : createFreshOnboardingState();

      setIsSyncing(true);

      try {
        const next = await repository.replaceFinanceData(userId, nextData);
        await repository.saveOnboardingState(userId, onboardingState);
        setData(coerceFinanceData(next));
        applyOnboardingState(onboardingState, {
          setOnboardingComplete,
          setOnboardingMode,
          setDemoProfileId,
        });
      } catch (onboardingError) {
        const message = getErrorMessage(onboardingError);
        setError(message);
        showToast({ title: "Setup failed", subtitle: message, type: "error" });
        throw onboardingError;
      } finally {
        setIsSyncing(false);
      }
    },
    [error, showToast],
  );

  const switchDemoProfile = useCallback(
    async (profileId: DemoProfileId) => {
      const repository = repositoryRef.current;
      const userId = userIdRef.current;

      if (!repository || !userId) {
        const message = error ?? "Finance data is not ready yet.";
        showToast({ title: "Unable to switch profile", subtitle: message, type: "error" });
        throw new Error(message);
      }

      if (!isUserInDemoMode(onboardingMode, dataRef.current)) {
        showToast({
          title: "Demo mode is off",
          subtitle: "Choose Explore a Demo during onboarding to try sample data.",
        });
        throw new Error("Demo mode is not active.");
      }

      const nextData = getDemoFinanceData(profileId);
      const onboardingState = createDemoOnboardingState(profileId);

      setIsSyncing(true);

      try {
        const next = await repository.replaceFinanceData(userId, nextData);
        await repository.saveOnboardingState(userId, onboardingState);
        setData(coerceFinanceData(next));
        applyOnboardingState(onboardingState, {
          setOnboardingComplete,
          setOnboardingMode,
          setDemoProfileId,
        });
      } catch (switchError) {
        const message = getErrorMessage(switchError);
        setError(message);
        showToast({ title: "Switch failed", subtitle: message, type: "error" });
        throw switchError;
      } finally {
        setIsSyncing(false);
      }
    },
    [error, onboardingMode, showToast],
  );

  const exitDemoMode = useCallback(async () => {
    const repository = repositoryRef.current;
    const userId = userIdRef.current;

    if (!repository || !userId) {
      const message = error ?? "Finance data is not ready yet.";
      showToast({ title: "Unable to exit demo mode", subtitle: message, type: "error" });
      throw new Error(message);
    }

    if (!isUserInDemoMode(onboardingMode, dataRef.current)) {
      return;
    }

    setIsSyncing(true);

    try {
      const { data: nextData, onboarding: onboardingState } =
        await repository.exitDemoMode(userId);
      setData(coerceFinanceData(nextData));
      applyOnboardingState(onboardingState, {
        setOnboardingComplete,
        setOnboardingMode,
        setDemoProfileId,
      });
    } catch (exitError) {
      const message = getErrorMessage(exitError);
      setError(message);
      showToast({ title: "Could not exit demo mode", subtitle: message, type: "error" });
      throw exitError;
    } finally {
      setIsSyncing(false);
    }
  }, [error, onboardingMode, showToast]);

  const addAccount = useCallback(
    async (input: AddAccountInput) => {
      const accountId = crypto.randomUUID();

      await runMutation(
        {
          ...data,
          accounts: [
            ...data.accounts,
            {
              id: accountId,
              name: input.name.trim(),
              institution: input.institution.trim(),
              type: input.type,
              balance: input.balance,
              monthlyChange: 0,
            },
          ],
        },
        (repository, userId) => repository.createAccount(userId, input, accountId),
        {
          events: [buildAccountAddedEvent(input.name.trim(), accountId)],
        },
      );
      trackEvent(ANALYTICS_EVENTS.ADDED_ACCOUNT, { account_type: input.type });
    },
    [data, runMutation],
  );

  const addIncome = useCallback(
    async (input: AddIncomeInput) => {
      const incomeId = crypto.randomUUID();
      const next = normalizeRecurringFinanceData({
        ...data,
        income: [
          ...data.income,
          {
            id: incomeId,
            name: input.name.trim(),
            amount: input.amount,
            frequency: input.frequency,
            category: input.category.trim(),
          },
        ],
      });

      await runMutation(
        next,
        (repository, userId) => repository.createIncome(userId, input, incomeId),
        {
          events: [
            buildIncomeAddedEvent(
              input.name.trim(),
              input.amount,
              incomeId,
            ),
          ],
        },
      );
    },
    [data, runMutation],
  );

  const editIncome = useCallback(
    async (incomeId: string, input: EditIncomeInput) => {
      const existing = data.income.find((source) => source.id === incomeId);

      if (!existing) {
        return;
      }

      const normalized = normalizeRecurringFinanceData(data);
      const current =
        normalized.income.find((source) => source.id === incomeId) ?? existing;
      const updated = buildUpdatedIncomeSource(current, input);

      await runMutation(
        {
          ...normalized,
          income: normalized.income.map((source) =>
            source.id === incomeId ? updated : source,
          ),
        },
        (repository, userId) => repository.updateIncome(userId, incomeId, input),
      );
    },
    [data, runMutation],
  );

  const deleteIncome = useCallback(
    async (incomeId: string) => {
      await runMutation(
        {
          ...data,
          income: data.income.filter((source) => source.id !== incomeId),
        },
        (repository, userId) => repository.deleteIncome(userId, incomeId),
      );
    },
    [data, runMutation],
  );

  const pauseIncome = useCallback(
    async (incomeId: string) => {
      const normalized = normalizeRecurringFinanceData(data);
      const existing = normalized.income.find((source) => source.id === incomeId);

      if (!existing?.schedule) {
        return;
      }

      await runMutation(
        {
          ...normalized,
          income: normalized.income.map((source) =>
            source.id === incomeId
              ? {
                  ...source,
                  schedule: {
                    ...source.schedule!,
                    status: "paused" as const,
                  },
                }
              : source,
          ),
        },
        (repository, userId) => repository.setIncomePaused(userId, incomeId, true),
      );
    },
    [data, runMutation],
  );

  const resumeIncome = useCallback(
    async (incomeId: string) => {
      const normalized = normalizeRecurringFinanceData(data);
      const existing = normalized.income.find((source) => source.id === incomeId);

      if (!existing?.schedule) {
        return;
      }

      await runMutation(
        {
          ...normalized,
          income: normalized.income.map((source) =>
            source.id === incomeId
              ? {
                  ...source,
                  schedule: {
                    ...source.schedule!,
                    status: "active" as const,
                  },
                }
              : source,
          ),
        },
        (repository, userId) => repository.setIncomePaused(userId, incomeId, false),
      );
    },
    [data, runMutation],
  );

  const markIncomeReceived = useCallback(
    async (incomeId: string) => {
      const income = data.income.find((source) => source.id === incomeId);

      if (!income) {
        return;
      }

      const normalized = normalizeRecurringFinanceData(data);
      const next = applyActivityToData(normalized, `income:${incomeId}`);

      await runMutation(next, (repository, userId) =>
        repository.markIncomeReceived(userId, incomeId),
      {
        events: [
          buildPaycheckProcessedEvent(income.name, income.amount),
        ],
      });
    },
    [data, runMutation],
  );

  const addDebt = useCallback(
    async (input: AddDebtInput) => {
      const debtId = crypto.randomUUID();

      await runMutation(
        {
          ...data,
          debts: [
            ...data.debts,
            {
              id: debtId,
              name: input.name.trim(),
              balance: input.balance,
              originalBalance: input.balance,
              interestRate: input.interestRate,
              minimumPayment: input.minimumPayment,
              monthlyChange: -input.minimumPayment,
              dueDay: input.dueDay,
              accountType: input.accountType,
            },
          ],
        },
        (repository, userId) => repository.createDebt(userId, input, debtId),
        {
          events: [buildDebtAddedEvent(input.name.trim(), debtId)],
        },
      );
    },
    [data, runMutation],
  );

  const editDebt = useCallback(
    async (debtId: string, input: EditDebtInput) => {
      const existing = data.debts.find((debt) => debt.id === debtId);

      if (!existing) {
        return;
      }

      const updated = buildUpdatedDebt(existing, input);

      await runMutation(
        {
          ...data,
          debts: data.debts.map((debt) =>
            debt.id === debtId ? updated : debt,
          ),
        },
        (repository, userId) => repository.updateDebt(userId, debtId, input),
      );
    },
    [data, runMutation],
  );

  const deleteDebt = useCallback(
    async (debtId: string) => {
      await runMutation(
        {
          ...data,
          debts: data.debts.filter((debt) => debt.id !== debtId),
        },
        (repository, userId) => repository.deleteDebt(userId, debtId),
      );
    },
    [data, runMutation],
  );

  const makeDebtPayment = useCallback(
    async (debtId: string, amount: number) => {
      const debt = data.debts.find((item) => item.id === debtId);

      if (!debt) {
        return;
      }

      const paymentAmount = Math.min(Math.max(amount, 0), debt.balance);
      const next = applyDebtPaymentToData(data, debtId, paymentAmount);

      await runMutation(
        next,
        (repository, userId) =>
          repository.makeDebtPayment(userId, debtId, paymentAmount),
        {
          events: [
            buildDebtPaymentEvent(debt.name, paymentAmount, debtId),
          ],
        },
      );
    },
    [data, runMutation],
  );

  const addBill = useCallback(
    async (input: AddBillInput) => {
      const billId = crypto.randomUUID();

      await runMutation(
        {
          ...data,
          bills: [
            ...data.bills,
            {
              id: billId,
              name: input.name.trim(),
              amount: input.amount,
              dueDay: input.dueDay,
              autopay: input.autopay,
              recurring: input.recurring,
              category: normalizeBillCategory(input.category),
              paidMonth: null,
              paycheckAssignment: normalizePaycheckAssignment(
                input.paycheckAssignment,
              ),
              customPayDay: input.customPayDay ?? null,
              paymentAccountId: input.paymentAccountId ?? null,
              splits:
                input.splits?.map((split, index) => ({
                  id: crypto.randomUUID(),
                  billId,
                  amount: split.amount,
                  dueDay: split.dueDay,
                  paycheckAssignment: normalizePaycheckAssignment(
                    split.paycheckAssignment,
                  ),
                  customPayDay: split.customPayDay ?? null,
                  paymentAccountId: split.paymentAccountId ?? null,
                  paidMonth: null,
                  paidAmount: 0,
                  sortOrder: split.sortOrder ?? index,
                })) ?? [],
            },
          ],
        },
        (repository, userId) => repository.createBill(userId, input, billId),
        {
          events: [buildBillAddedEvent(input.name.trim(), billId)],
        },
      );
      trackEvent(ANALYTICS_EVENTS.ADDED_BILL, { recurring: input.recurring });
    },
    [data, runMutation],
  );

  const editBill = useCallback(
    async (billId: string, input: EditBillInput) => {
      const normalized = normalizeRecurringFinanceData(data);
      const existing = normalized.bills.find((bill) => bill.id === billId);

      if (!existing) {
        return;
      }

      const updated = buildUpdatedBill(existing, input);

      await runMutation(
        {
          ...normalized,
          bills: normalized.bills.map((bill) =>
            bill.id === billId ? updated : bill,
          ),
        },
        (repository, userId) => repository.updateBill(userId, billId, input),
      );
    },
    [data, runMutation],
  );

  const deleteBill = useCallback(
    async (billId: string) => {
      await runMutation(
        {
          ...data,
          bills: data.bills.filter((bill) => bill.id !== billId),
        },
        (repository, userId) => repository.deleteBill(userId, billId),
      );
    },
    [data, runMutation],
  );

  const markBillSplitPaid = useCallback(
    async (billId: string, splitId: string, paymentAmount?: number) => {
      const bill = data.bills.find((item) => item.id === billId);

      if (!bill) {
        return;
      }

      const next = applyBillSplitPaymentByIdToData(
        data,
        billId,
        splitId,
        paymentAmount,
      );
      const split = next.bills
        .find((item) => item.id === billId)
        ?.splits?.find((item) => item.id === splitId);
      const progressName =
        (bill.splits?.length ?? 0) > 1 && split
          ? `${bill.name} · due ${split.dueDay}`
          : bill.name;
      const paidAmount =
        paymentAmount ??
        next.transactions.find((transaction) => transaction.billId === billId)
          ?.amount ??
        split?.amount ??
        bill.amount;

      await runMutation(
        next,
        (repository, userId) =>
          repository.markBillSplitPaid(
            userId,
            billId,
            splitId,
            paymentAmount,
          ),
        {
          events: [
            buildBillPaidEvent(progressName, paidAmount, bill.id),
          ],
        },
      );
    },
    [data, runMutation],
  );

  const markBillPaid = useCallback(
    async (billId: string) => {
      const bill = data.bills.find((item) => item.id === billId);

      if (!bill) {
        return;
      }

      const splitId =
        bill.splits?.[0]?.id ??
        `${billId}-legacy`;

      await markBillSplitPaid(billId, splitId);
    },
    [markBillSplitPaid, data.bills],
  );

  const createGoal = useCallback(
    async (input: CreateGoalInput) => {
      const meta = getGoalTypeMeta(input.type);
      const goalId = crypto.randomUUID();

      await runMutation(
        {
          ...data,
          savingsGoals: [
            ...data.savingsGoals,
            {
              id: goalId,
              name: input.name.trim(),
              type: input.type,
              icon: meta.icon,
              current: input.current,
              target: input.target,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        (repository, userId) => repository.createGoal(userId, input, goalId),
        {
          events: [buildGoalCreatedEvent(input.name.trim(), goalId)],
        },
      );
      trackEvent(ANALYTICS_EVENTS.CREATED_GOAL, { goal_type: input.type });
    },
    [data, runMutation],
  );

  const editGoal = useCallback(
    async (goalId: string, input: EditGoalInput) => {
      const meta = getGoalTypeMeta(input.type);

      await runMutation(
        {
          ...data,
          savingsGoals: data.savingsGoals.map((goal) =>
            goal.id === goalId
              ? {
                  ...goal,
                  name: input.name.trim(),
                  type: input.type,
                  icon: meta.icon,
                  target: input.target,
                }
              : goal,
          ),
        },
        (repository, userId) => repository.updateGoal(userId, goalId, input),
      );
    },
    [data, runMutation],
  );

  const addMoneyToGoal = useCallback(
    async (input: AddMoneyToGoalInput) => {
      const goal = data.savingsGoals.find((item) => item.id === input.goalId);

      if (!goal) {
        return;
      }

      const next = applyGoalContributionToData(
        data,
        input.goalId,
        input.amount,
      );

      await runMutation(
        next,
        (repository, userId) => repository.addMoneyToGoal(userId, input),
        {
          events: [
            buildGoalContributionEvent(goal.name, input.amount, goal.id),
          ],
        },
      );
    },
    [data, runMutation],
  );

  const applyTodayActivity = useCallback(
    async (activityId: string) => {
      const normalized = normalizeRecurringFinanceData(data);
      const { activities } = generateTodayActivity(normalized);
      const activity = activities.find((item) => item.id === activityId);

      if (!activity) {
        return;
      }

      const next = applyActivityToData(normalized, activityId);

      await runMutation(next, (repository, userId) =>
        repository.saveRecurringState(userId, next),
      {
        events: buildEventsForTodayActivity(activity, normalized),
      });
    },
    [data, runMutation],
  );

  const applyAllTodayActivity = useCallback(
    async () => {
      const normalized = normalizeRecurringFinanceData(data);
      const { activities } = generateTodayActivity(normalized);
      const next = applyAllActivitiesToData(normalized, activities);

      await runMutation(next, (repository, userId) =>
        repository.saveRecurringState(userId, next),
      {
        events: activities.flatMap((activity) =>
          buildEventsForTodayActivity(activity, normalized),
        ),
      });
    },
    [data, runMutation],
  );

  const addTransaction = useCallback(
    async (input: AddTransactionInput) => {
      const transaction = buildTransactionFromInput(input);
      const next = addTransactionToData(data, transaction);
      const event =
        input.type === "income"
          ? buildPaycheckProcessedEvent(
              input.category.trim() || "Paycheck",
              input.amount,
            )
          : buildTransactionAddedEvent(
              input.type === "expense"
                ? `- ${input.category.trim()}`
                : `+ ${input.category.trim()}`,
              input.amount,
              transaction.id,
            );

      await runMutation(next, (repository, userId) =>
        repository.createTransaction(userId, next, transaction),
      {
        events: [event],
      });
    },
    [data, runMutation],
  );

  const editTransaction = useCallback(
    async (transactionId: string, input: EditTransactionInput) => {
      const existing = data.transactions.find(
        (transaction) => transaction.id === transactionId,
      );

      if (!existing) {
        return;
      }

      const updated = buildUpdatedTransaction(existing, input);
      const next = updateTransactionInData(data, transactionId, updated);

      await runMutation(next, (repository, userId) =>
        repository.updateTransaction(userId, transactionId, next, updated),
      );
    },
    [data, runMutation],
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      const next = removeTransactionFromData(data, transactionId);

      await runMutation(next, (repository, userId) =>
        repository.deleteTransaction(userId, transactionId, next),
      );
    },
    [data, runMutation],
  );

  const saveIncomePlan = useCallback(
    async (input: SaveIncomePlanInput) => {
      const hadPlan = Boolean(data.incomePlan);

      await runMutation(
        {
          ...data,
          incomePlan: data.incomePlan
            ? {
                ...data.incomePlan,
                paySchedule: input.paySchedule,
                paycheckAmount: input.paycheckAmount,
                anchorDate: input.anchorDate,
                weeklyDayOfWeek: input.weeklyDayOfWeek,
                monthlyDays: input.monthlyDays,
                customIntervalDays: input.customIntervalDays,
                depositAccountId: input.depositAccountId,
                allocations: input.allocations.map((allocation, index) => ({
                  ...allocation,
                  id: crypto.randomUUID(),
                  sortOrder: allocation.sortOrder ?? index,
                })),
              }
            : null,
        },
        (repository, userId) => repository.saveIncomePlan(userId, input),
      );

      if (!hadPlan) {
        trackEvent(ANALYTICS_EVENTS.CREATED_INCOME_PLAN, {
          pay_schedule: input.paySchedule,
        });
      }

      if (input.allocations.length > 0) {
        trackEvent(
          ANALYTICS_EVENTS.CREATED_BUDGET,
          { allocation_count: input.allocations.length },
          { once: true, dedupeKey: "created-budget" },
        );
      }
    },
    [data, runMutation],
  );

  const markIncomePlanPaycheckReceived = useCallback(
    async (input: MarkPaycheckReceivedInput = {}) => {
      const plan = data.incomePlan;

      if (!plan) {
        return;
      }

      const { data: next } = applyIncomePlanPaycheckToData(data, plan, input);

      await runMutation(
        next,
        (repository, userId) =>
          repository.markIncomePlanPaycheckReceived(userId, input),
        {
          events: [
            buildPaycheckProcessedEvent("Income Plan", plan.paycheckAmount),
          ],
        },
      );
    },
    [data, runMutation],
  );

  const dismissAutomationSuggestionHandler = useCallback((suggestionId: string) => {
    persistDismissedAutomationSuggestion(suggestionId);
    setAutomationDismissRevision((value) => value + 1);
  }, []);

  const dismissAutomationSuggestionPermanently = useCallback(
    async (suggestion: AutomationSuggestion) => {
      const merchantKey = String(
        suggestion.tertiaryAction?.payload?.merchantKey ??
          suggestion.entityId ??
          "",
      ).trim();

      if (merchantKey) {
        await dismissPlaidRecurringSuggestion(merchantKey);
        setData((current) => ({
          ...current,
          plaidRecurringDismissals: [
            ...new Set([...(current.plaidRecurringDismissals ?? []), merchantKey]),
          ],
        }));
      }

      persistDismissedAutomationSuggestion(suggestion.id);
      setAutomationDismissRevision((value) => value + 1);
    },
    [],
  );

  const connectBank = useCallback(async () => {
    return fetchPlaidLinkToken({ mode: "create" });
  }, []);

  const reconnectBank = useCallback(async (connectionId: string) => {
    return fetchPlaidLinkToken({ connectionId, mode: "update" });
  }, []);

  const syncBank = useCallback(
    async (connectionId?: string) => {
      setIsSyncing(true);

      try {
        await syncPlaidBank(connectionId);
        await refreshFinance();
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshFinance],
  );

  const disconnectBank = useCallback(
    async (connectionId: string) => {
      setIsSyncing(true);

      try {
        await disconnectPlaidBank(connectionId);
        await refreshFinance();
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshFinance],
  );

  const completeAutomationSuggestion = useCallback(
    async (suggestion: AutomationSuggestion) => {
      try {
        switch (suggestion.primaryAction.type) {
          case "create_bill": {
            const payload = suggestion.primaryAction.payload ?? {};
            await addBill({
              name: String(payload.name ?? "Bill"),
              amount: Number(payload.amount ?? 0),
              dueDay: Number(payload.dueDay ?? 1),
              autopay: Boolean(payload.autopay),
              recurring: Boolean(payload.recurring ?? true),
              category: String(payload.category ?? "Other"),
            });
            showToast({
              title: "Recurring bill created",
              subtitle: String(payload.name ?? "Your bill"),
              type: "success",
            });
            break;
          }
          case "apply_paycheck":
            await markIncomePlanPaycheckReceived();
            showToast({
              title: "Income Plan applied",
              subtitle: "Allocations updated across your dashboard.",
              type: "success",
            });
            break;
          case "navigate":
            if (suggestion.primaryAction.href) {
              window.location.href = suggestion.primaryAction.href;
            }
            break;
          default:
            break;
        }
      } finally {
        persistDismissedAutomationSuggestion(suggestion.id);
        setAutomationDismissRevision((value) => value + 1);
      }
    },
    [addBill, markIncomePlanPaycheckReceived, showToast],
  );

  const hub = useMemo(() => computeFinanceHub(data), [data]);
  const mergedNotifications = useMemo(
    () => mergeAutomationNotifications(hub.notifications, automationSuggestions),
    [automationSuggestions, hub.notifications],
  );
  const mergedUnreadCount = useMemo(
    () => hub.unreadNotificationCount + automationSuggestions.length,
    [automationSuggestions.length, hub.unreadNotificationCount],
  );
  const isDemoMode = isUserInDemoMode(onboardingMode, data);

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...data,
      dashboard: hub.dashboard,
      recentActivity: hub.recentActivity,
      notifications: mergedNotifications,
      unreadNotificationCount: mergedUnreadCount,
      automationSuggestions,
      isLoading,
      isSyncing,
      error,
      onboardingComplete,
      onboardingMode,
      demoProfileId,
      isDemoMode,
      refreshFinance,
      completeOnboarding,
      switchDemoProfile,
      exitDemoMode,
      addAccount,
      addIncome,
      editIncome,
      deleteIncome,
      pauseIncome,
      resumeIncome,
      markIncomeReceived,
      addDebt,
      editDebt,
      deleteDebt,
      makeDebtPayment,
      addBill,
      editBill,
      deleteBill,
      markBillPaid,
      markBillSplitPaid,
      createGoal,
      addSavingsGoal: createGoal,
      editGoal,
      addMoneyToGoal,
      applyTodayActivity,
      applyAllTodayActivity,
      addTransaction,
      editTransaction,
      deleteTransaction,
      saveIncomePlan,
      markIncomePlanPaycheckReceived,
      runIncomePlan: markIncomePlanPaycheckReceived,
      dismissAutomationSuggestion: dismissAutomationSuggestionHandler,
      dismissAutomationSuggestionPermanently,
      completeAutomationSuggestion,
      connectBank,
      reconnectBank,
      syncBank,
      disconnectBank,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      addAccount,
      addBill,
      addDebt,
      addIncome,
      addMoneyToGoal,
      addTransaction,
      applyAllTodayActivity,
      applyTodayActivity,
      completeOnboarding,
      createGoal,
      completeAutomationSuggestion,
      connectBank,
      reconnectBank,
      syncBank,
      disconnectBank,
      data,
      deleteBill,
      dismissAutomationSuggestionHandler,
      dismissAutomationSuggestionPermanently,
      deleteDebt,
      deleteIncome,
      deleteTransaction,
      saveIncomePlan,
      markIncomePlanPaycheckReceived,
      demoProfileId,
      editBill,
      editDebt,
      editGoal,
      editIncome,
      editTransaction,
      error,
      exitDemoMode,
      hub.dashboard,
      hub.recentActivity,
      mergedNotifications,
      mergedUnreadCount,
      automationSuggestions,
      isLoading,
      isSyncing,
      isDemoMode,
      markAllNotificationsRead,
      markBillPaid,
      markBillSplitPaid,
      markIncomeReceived,
      makeDebtPayment,
      markNotificationRead,
      onboardingComplete,
      onboardingMode,
      pauseIncome,
      refreshFinance,
      resumeIncome,
      switchDemoProfile,
    ],
  );

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);

  if (!context) {
    throw new Error("useFinance must be used within a FinanceProvider");
  }

  return context;
}

export { FinanceContext };
