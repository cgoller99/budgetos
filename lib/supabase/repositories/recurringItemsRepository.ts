import type { FinanceData } from "@/lib/finance/types";
import type {
  RecurringItemInsert,
  RecurringEntityType,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { serializeSchedule } from "@/lib/recurring/normalize";
import type { RecurringSchedule } from "@/lib/recurring/types";

function buildRecurringItem(
  userId: string,
  entityType: RecurringEntityType,
  entityId: string,
  frequency: string,
  amount: number | null,
  schedule: RecurringSchedule,
): RecurringItemInsert {
  const serialized = serializeSchedule(schedule);

  return {
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    frequency,
    amount,
    start_date: serialized.start_date ?? null,
    next_occurrence: serialized.next_occurrence ?? null,
    last_processed_date: serialized.last_processed_date ?? null,
    recurring_status: serialized.recurring_status ?? "active",
    updated_at: new Date().toISOString(),
  };
}

export function extractRecurringItems(
  userId: string,
  data: FinanceData,
): RecurringItemInsert[] {
  const items: RecurringItemInsert[] = [];

  for (const income of data.income) {
    if (!income.schedule) {
      continue;
    }

    items.push(
      buildRecurringItem(
        userId,
        "income",
        income.id,
        income.frequency,
        income.amount,
        income.schedule,
      ),
    );
  }

  for (const bill of data.bills) {
    if (!bill.schedule) {
      continue;
    }

    items.push(
      buildRecurringItem(
        userId,
        "bill",
        bill.id,
        bill.frequency ?? bill.schedule.frequency ?? "monthly",
        bill.amount,
        bill.schedule,
      ),
    );
  }

  for (const goal of data.savingsGoals) {
    if (!goal.autoContribution?.schedule) {
      continue;
    }

    items.push(
      buildRecurringItem(
        userId,
        "goal",
        goal.id,
        goal.autoContribution.frequency,
        goal.autoContribution.amount,
        goal.autoContribution.schedule,
      ),
    );
  }

  for (const investment of data.investments) {
    if (!investment.autoContribution?.schedule) {
      continue;
    }

    items.push(
      buildRecurringItem(
        userId,
        "investment",
        investment.id,
        investment.autoContribution.frequency,
        investment.autoContribution.amount,
        investment.autoContribution.schedule,
      ),
    );
  }

  return items;
}

export class RecurringItemsRepository {
  constructor(private readonly supabase: BuxmeSupabaseClient) {}

  async syncFromFinanceData(userId: string, data: FinanceData): Promise<void> {
    const items = extractRecurringItems(userId, data);

    if (items.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .from("recurring_items")
      .upsert(items, { onConflict: "user_id,entity_type,entity_id" });

    if (error) {
      throw error;
    }
  }
}
