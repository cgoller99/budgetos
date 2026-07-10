import type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanPaycheckEvent,
  SaveIncomePlanInput,
} from "@/lib/incomePlan/types";
import { computeNextPayDate } from "@/lib/incomePlan/payDates";
import type {
  IncomePlanAllocationEventRow,
  IncomePlanAllocationRow,
  IncomePlanPaycheckEventRow,
  IncomePlanRow,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  householdFinanceOrFilter,
  resolveUserHouseholdId,
} from "@/lib/supabase/householdFinance";

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function mapAllocationRow(row: IncomePlanAllocationRow): IncomePlanAllocation {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    amount: row.amount === null ? null : toNumber(row.amount),
    percentage: row.percentage === null ? null : toNumber(row.percentage),
    allocationType: (row.allocation_type as IncomePlanAllocation["allocationType"]) ?? null,
    isRemainingBalance: row.is_remaining_balance,
    accountId: row.account_id,
    goalId: row.goal_id,
    billId: row.bill_id ?? null,
    debtId: row.debt_id ?? null,
    investmentId: row.investment_id ?? null,
    monthlyTarget:
      row.monthly_target === null ? null : toNumber(row.monthly_target),
    contributionFrequency:
      (row.contribution_frequency as IncomePlanAllocation["contributionFrequency"]) ??
      null,
    sortOrder: row.sort_order,
  };
}

function mapPaycheckEventRow(
  row: IncomePlanPaycheckEventRow,
  allocationEvents: IncomePlanAllocationEventRow[],
): IncomePlanPaycheckEvent {
  return {
    id: row.id,
    incomePlanId: row.income_plan_id,
    payDate: row.pay_date,
    grossAmount: toNumber(row.gross_amount),
    isExtraPaycheck: row.is_extra_paycheck,
    incomeTransactionId: row.income_transaction_id,
    allocationEvents: allocationEvents
      .filter((event) => event.paycheck_event_id === row.id)
      .map((event) => ({
        id: event.id,
        allocationId: event.allocation_id,
        amount: toNumber(event.amount),
        transactionId: event.transaction_id,
      })),
  };
}

export function mapIncomePlanRow(
  row: IncomePlanRow,
  allocations: IncomePlanAllocationRow[],
): IncomePlan {
  return {
    id: row.id,
    paySchedule: row.pay_schedule as IncomePlan["paySchedule"],
    paycheckAmount: toNumber(row.paycheck_amount),
    anchorDate: row.anchor_date,
    weeklyDayOfWeek: row.weekly_day_of_week,
    monthlyDays: row.monthly_days ?? [1, 15],
    customIntervalDays: row.custom_interval_days,
    depositAccountId: row.deposit_account_id,
    nextPayDate: row.next_pay_date,
    lastProcessedDate: row.last_processed_date,
    isActive: row.is_active,
    ownerUserId: row.user_id,
    allocations: allocations
      .filter((item) => item.income_plan_id === row.id)
      .map(mapAllocationRow)
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

export class IncomePlanRepository {
  constructor(private readonly supabase: BuxmeSupabaseClient) {}

  private withHouseholdId<T extends Record<string, unknown>>(
    row: T,
    householdId: string | null,
  ): T {
    if (!householdId) return row;
    return { ...row, household_id: householdId };
  }

  private scopedSelect(table: string, userId: string, householdId: string | null) {
    const scopeFilter = householdFinanceOrFilter(userId, householdId);
    let query = this.supabase.from(table).select("*");

    if (scopeFilter) {
      query = query.or(scopeFilter);
    } else {
      query = query.eq("user_id", userId);
    }

    return query;
  }

  async loadIncomePlanData(userId: string): Promise<{
    incomePlan: IncomePlan | null;
    incomePlanPaychecks: IncomePlanPaycheckEvent[];
  }> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);

    const [planResult, allocationResult, paycheckResult, allocationEventResult] =
      await Promise.all([
        this.supabase
          .from("income_plans")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
        this.scopedSelect("income_plan_allocations", userId, householdId),
        this.scopedSelect("income_plan_paycheck_events", userId, householdId)
          .order("pay_date", { ascending: false })
          .limit(24),
        this.scopedSelect("income_plan_allocation_events", userId, householdId),
      ]);

    if (planResult.error) {
      if (planResult.error.message.includes("income_plans")) {
        return { incomePlan: null, incomePlanPaychecks: [] };
      }
      throw planResult.error;
    }

    if (!planResult.data) {
      return { incomePlan: null, incomePlanPaychecks: [] };
    }

    const allocationRows = allocationResult.error ? [] : allocationResult.data ?? [];
    const paycheckRows = paycheckResult.error ? [] : paycheckResult.data ?? [];
    const allocationEventRows = allocationEventResult.error
      ? []
      : allocationEventResult.data ?? [];

    const incomePlan = mapIncomePlanRow(planResult.data, allocationRows);
    const incomePlanPaychecks = paycheckRows.map((row) =>
      mapPaycheckEventRow(row, allocationEventRows),
    );

    return { incomePlan, incomePlanPaychecks };
  }

  async saveIncomePlan(
    userId: string,
    input: SaveIncomePlanInput,
    existingPlanId?: string | null,
  ): Promise<{ incomePlan: IncomePlan | null; incomePlanPaychecks: IncomePlanPaycheckEvent[] }> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const timestamp = new Date().toISOString();
    const planId = existingPlanId ?? crypto.randomUUID();
    const nextPayDate = computeNextPayDate(
      input.paySchedule,
      input.anchorDate,
      new Date(),
      {
        weeklyDayOfWeek: input.weeklyDayOfWeek,
        monthlyDays: input.monthlyDays,
        customIntervalDays: input.customIntervalDays,
      },
    );

    if (existingPlanId) {
      const { error: updateError } = await this.supabase
        .from("income_plans")
        .update({
          pay_schedule: input.paySchedule,
          paycheck_amount: input.paycheckAmount,
          anchor_date: input.anchorDate,
          weekly_day_of_week: input.weeklyDayOfWeek,
          monthly_days: input.monthlyDays,
          custom_interval_days: input.customIntervalDays,
          deposit_account_id: input.depositAccountId,
          next_pay_date: nextPayDate,
          updated_at: timestamp,
        })
        .eq("id", existingPlanId)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      await this.supabase
        .from("income_plan_allocations")
        .delete()
        .eq("income_plan_id", existingPlanId)
        .eq("user_id", userId);
    } else {
      const { error: insertError } = await this.supabase.from("income_plans").insert(
        this.withHouseholdId(
          {
            id: planId,
            user_id: userId,
            pay_schedule: input.paySchedule,
            paycheck_amount: input.paycheckAmount,
            anchor_date: input.anchorDate,
            weekly_day_of_week: input.weeklyDayOfWeek,
            monthly_days: input.monthlyDays,
            custom_interval_days: input.customIntervalDays,
            deposit_account_id: input.depositAccountId,
            next_pay_date: nextPayDate,
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp,
          },
          householdId,
        ),
      );

      if (insertError) throw insertError;
    }

    const allocationRows = input.allocations.map((allocation, index) =>
      this.withHouseholdId(
        {
          id: crypto.randomUUID(),
          income_plan_id: planId,
          user_id: userId,
          name: allocation.name.trim(),
          icon: allocation.icon,
          amount: allocation.isRemainingBalance ? null : allocation.amount,
          percentage: allocation.percentage,
          allocation_type: allocation.allocationType ?? (allocation.isRemainingBalance ? "remaining" : allocation.percentage ? "percentage" : "fixed"),
          is_remaining_balance: allocation.isRemainingBalance,
          account_id: allocation.accountId,
          goal_id: allocation.goalId,
          bill_id: allocation.billId,
          debt_id: allocation.debtId,
          investment_id: allocation.investmentId,
          monthly_target: allocation.monthlyTarget,
          contribution_frequency: allocation.contributionFrequency,
          sort_order: allocation.sortOrder ?? index,
          created_at: timestamp,
          updated_at: timestamp,
        },
        householdId,
      ),
    );

    if (allocationRows.length > 0) {
      const { error: allocationError } = await this.supabase
        .from("income_plan_allocations")
        .insert(allocationRows);

      if (allocationError) throw allocationError;
    }

    return this.loadIncomePlanData(userId);
  }

  async deleteIncomePlan(userId: string, planId: string): Promise<void> {
    const { error } = await this.supabase
      .from("income_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId);

    if (error) throw error;
  }

  async persistPaycheckReceived(
    userId: string,
    plan: IncomePlan,
    paycheckEvent: IncomePlanPaycheckEvent,
  ): Promise<void> {
    const householdId = await resolveUserHouseholdId(this.supabase, userId);
    const timestamp = new Date().toISOString();

    const { error: planError } = await this.supabase
      .from("income_plans")
      .update({
        next_pay_date: plan.nextPayDate,
        last_processed_date: plan.lastProcessedDate,
        updated_at: timestamp,
      })
      .eq("id", plan.id)
      .eq("user_id", userId);

    if (planError) throw planError;

    const { error: paycheckError } = await this.supabase
      .from("income_plan_paycheck_events")
      .insert(
        this.withHouseholdId(
          {
            id: paycheckEvent.id,
            income_plan_id: plan.id,
            user_id: userId,
            pay_date: paycheckEvent.payDate,
            gross_amount: paycheckEvent.grossAmount,
            is_extra_paycheck: paycheckEvent.isExtraPaycheck,
            income_transaction_id: paycheckEvent.incomeTransactionId,
            created_at: timestamp,
          },
          householdId,
        ),
      );

    if (paycheckError) throw paycheckError;

    // income_plan_allocation_events has no household_id column; it is scoped by
    // user_id via RLS and inherits household context from its parent paycheck event.
    const allocationEventRows = paycheckEvent.allocationEvents.map((event) => ({
      id: event.id,
      paycheck_event_id: paycheckEvent.id,
      allocation_id: event.allocationId,
      user_id: userId,
      amount: event.amount,
      transaction_id: event.transactionId,
      created_at: timestamp,
    }));

    if (allocationEventRows.length > 0) {
      const { error: allocationEventError } = await this.supabase
        .from("income_plan_allocation_events")
        .insert(allocationEventRows);

      if (allocationEventError) throw allocationEventError;
    }
  }
}
