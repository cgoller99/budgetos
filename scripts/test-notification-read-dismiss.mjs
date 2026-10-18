#!/usr/bin/env node
/**
 * Regression tests for notification mark-read / mark-all / dismiss / badge.
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";

function createEmptyFinanceData() {
  return structuredClone(emptyFinanceData);
}
import {
  appendEvents,
  buildBillDueTomorrowEvent,
  buildGoalReachedVirtualEvent,
  deriveBillDueTomorrowEvents,
  markEventRead,
} from "../lib/events/eventStore.ts";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "../lib/events/selectors.ts";
import {
  acknowledgeVirtualNotification,
  clearAllNotificationsInData,
  dismissNotificationFromData,
  markAllNotificationsReadInData,
  markNotificationReadInData,
} from "../lib/notifications/readDismiss.ts";

const ENTITY = "11111111-1111-4111-8111-111111111111";
const GOAL = "22222222-2222-4222-8222-222222222222";

console.log("1) Legacy bug: markEventRead on virtual id is a no-op");
{
  let data = createEmptyFinanceData();
  const virtualId = `virtual-bill-due-${ENTITY}`;
  data = markEventRead(data, virtualId);
  assert.equal((data.events ?? []).length, 0);
}

console.log("2) Mark stored notification read updates badge");
{
  let data = createEmptyFinanceData();
  const event = {
    ...buildBillDueTomorrowEvent("Rent", 1800, ENTITY),
    read: false,
  };
  data = appendEvents(data, [event]);
  assert.ok(getUnreadNotificationCount(data) >= 1);
  data = markNotificationReadInData(data, event.id);
  assert.equal((data.events ?? []).find((e) => e.id === event.id)?.read, true);
  assert.equal(
    getNotifications(data).find((n) => n.id === event.id)?.read,
    true,
  );
}

console.log("3) Acknowledge virtual bill persists and suppresses regenerate");
{
  let data = createEmptyFinanceData();
  const virtualId = `virtual-bill-due-${ENTITY}`;
  data = acknowledgeVirtualNotification(data, {
    id: virtualId,
    eventType: "bill_due_tomorrow",
    entityId: ENTITY,
    title: "Rent due tomorrow",
    subtitle: "$1,800 due tomorrow",
    isVirtual: true,
  });
  assert.ok(
    (data.events ?? []).some(
      (e) => e.type === "bill_due_tomorrow" && e.entityId === ENTITY && e.read,
    ),
  );
  assert.equal(
    deriveBillDueTomorrowEvents({
      ...data,
      bills: [
        {
          id: "bill-1",
          name: "Rent",
          amount: 1800,
          dueDate: new Date().toISOString().slice(0, 10),
          category: "Housing",
          frequency: "monthly",
          isPaid: false,
          accountId: null,
          notes: "",
          splits: [
            {
              id: ENTITY,
              name: "Rent",
              amount: 1800,
              dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
              isPaid: false,
              accountId: null,
            },
          ],
        },
      ],
    }).filter((e) => e.entityId === ENTITY).length,
    0,
    "acknowledged bill does not regenerate as virtual",
  );
}

console.log("4) Dismiss virtual keeps it out of notification surface");
{
  let data = createEmptyFinanceData();
  const virtualId = `virtual-goal-reached-${GOAL}`;
  data = dismissNotificationFromData(data, {
    id: virtualId,
    eventType: "goal_completed",
    entityId: GOAL,
    title: "House Goal Reached",
    isVirtual: true,
  });
  const ack = (data.events ?? []).find(
    (e) => e.type === "goal_completed" && e.entityId === GOAL,
  );
  assert.ok(ack);
  assert.equal(ack.read, true);
  assert.equal(ack.surfaces.includes("notification"), false);
  assert.equal(
    getNotifications(data).some((n) => n.entityId === GOAL && n.eventType === "goal_completed"),
    false,
  );
}

console.log("5) Mark all read clears stored unread");
{
  let data = createEmptyFinanceData();
  data = appendEvents(data, [
    { ...buildBillDueTomorrowEvent("A", 10, ENTITY), read: false },
    {
      ...buildGoalReachedVirtualEvent("House", GOAL),
      read: false,
    },
  ]);
  data = markAllNotificationsReadInData(data);
  assert.ok((data.events ?? []).every((e) => e.read));
}

console.log("6) Clear all removes notification-surface events");
{
  let data = createEmptyFinanceData();
  data = appendEvents(data, [
    { ...buildBillDueTomorrowEvent("A", 10, ENTITY), read: false },
  ]);
  data = clearAllNotificationsInData(data);
  assert.equal(
    (data.events ?? []).filter((e) => e.surfaces?.includes("notification")).length,
    0,
  );
}

console.log("7) Dismissed virtual ids are excluded from unread helper");
{
  const data = createEmptyFinanceData();
  const items = getNotifications(data);
  assert.ok(items.length >= 1, "empty data still surfaces weekly summary virtual");
  const weekly = items.find((n) => n.eventType === "weekly_summary_ready");
  assert.ok(weekly, "weekly summary virtual present");
  assert.match(weekly.id, /^virtual-weekly-summary-/);
  const dismissed = new Set([weekly.id]);
  assert.equal(getUnreadNotificationCount(data, dismissed), 0);
}

console.log("8) Dismiss after mark-read must not regenerate weekly unread");
{
  let data = createEmptyFinanceData();
  const weekly = getNotifications(data).find(
    (n) => n.eventType === "weekly_summary_ready",
  );
  assert.ok(weekly);
  data = markNotificationReadInData(data, {
    id: weekly.id,
    eventType: "weekly_summary_ready",
    title: weekly.title,
    isVirtual: true,
  });
  assert.equal(getUnreadNotificationCount(data), 0);
  const stored = (data.events ?? []).find((e) => e.type === "weekly_summary_ready");
  assert.ok(stored);
  data = dismissNotificationFromData(data, stored.id);
  assert.equal(getUnreadNotificationCount(data), 0);
  assert.equal(
    getNotifications(data).some((n) => n.eventType === "weekly_summary_ready"),
    false,
  );
}

console.log("9) Cross-user isolation is enforced at repository query shape");
{
  // Static contract: markRead / delete always scope by user_id.
  const fs = await import("node:fs");
  const source = fs.readFileSync(
    new URL("../lib/supabase/repositories/notificationsRepository.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /\.eq\("id", notificationId\)\s*\.eq\("user_id", userId\)/);
  assert.match(source, /\.eq\("user_id", userId\)\s*\.eq\("read", false\)/);
  assert.match(source, /delete\(\)[\s\S]*\.eq\("id", notificationId\)[\s\S]*\.eq\("user_id", userId\)/);
}

console.log("✅ notification read/dismiss regressions passed.");
