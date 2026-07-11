import type { FinanceEvent } from "@/lib/events/types";
import { MAX_EVENT_HISTORY } from "@/lib/events/types";
import type {
  NotificationInsert,
  NotificationRow,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

function mapNotificationRow(row: NotificationRow): FinanceEvent {
  return {
    id: row.id,
    type: row.event_type as FinanceEvent["type"],
    label: row.label,
    description: row.description,
    icon: row.icon,
    tone: row.tone as FinanceEvent["tone"],
    surfaces: row.surfaces as FinanceEvent["surfaces"],
    entityId: row.entity_id ?? undefined,
    entityType: row.entity_type ?? undefined,
    amount: row.amount != null ? Number(row.amount) : undefined,
    timestamp: row.created_at,
    read: row.read,
  };
}

function buildNotificationInsert(
  userId: string,
  event: FinanceEvent,
): NotificationInsert {
  return {
    id: event.id,
    user_id: userId,
    event_type: event.type,
    label: event.label,
    description: event.description,
    icon: event.icon,
    tone: event.tone,
    surfaces: [...event.surfaces],
    entity_id: event.entityId ?? null,
    entity_type: event.entityType ?? null,
    amount: event.amount ?? null,
    read: event.read,
    created_at: event.timestamp,
  };
}

export class NotificationsRepository {
  constructor(private readonly supabase: BuxmeSupabaseClient) {}

  async loadEvents(userId: string): Promise<FinanceEvent[]> {
    const { data, error } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_EVENT_HISTORY);

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapNotificationRow);
  }

  async saveEvents(userId: string, events: FinanceEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const rows = events
      .slice(0, MAX_EVENT_HISTORY)
      .map((event) => buildNotificationInsert(userId, event));

    const { error } = await this.supabase
      .from("notifications")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      throw error;
    }
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      throw error;
    }
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  async clearAll(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }
}

export { mapNotificationRow, buildNotificationInsert };
