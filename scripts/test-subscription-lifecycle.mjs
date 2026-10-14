import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { subscriptionLifecycleCaptures } from "../lib/analytics/subscriptionLifecycle.ts";

const allowedKeys = new Set(["plan", "provider", "at_period_end", "trial"]);

function names(input) {
  const captures = subscriptionLifecycleCaptures(input);
  for (const capture of captures) {
    for (const key of Object.keys(capture.properties)) {
      assert.ok(allowedKeys.has(key), key);
    }
    assert.equal(typeof capture.properties.plan, "string");
  }
  return captures.map((capture) => capture.event);
}

assert.deepEqual(
  names({
    provider: "stripe",
    eventType: "customer.subscription.created",
    status: "active",
    plan: "pro",
  }),
  ["subscription_purchased"],
);

assert.deepEqual(
  names({
    provider: "stripe",
    eventType: "customer.subscription.created",
    status: "trialing",
    plan: "pro_plus",
  }),
  ["subscription_started"],
);

assert.deepEqual(
  names({
    provider: "stripe",
    eventType: "customer.subscription.updated",
    status: "active",
    previousStatus: "incomplete",
    plan: "pro",
  }),
  ["subscription_purchased"],
);

assert.deepEqual(
  names({
    provider: "stripe",
    eventType: "customer.subscription.updated",
    status: "active",
    previousStatus: "trialing",
    plan: "pro",
  }),
  ["subscription_purchased"],
);

assert.deepEqual(
  names({
    provider: "stripe",
    eventType: "customer.subscription.updated",
    status: "active",
    previousStatus: "active",
    plan: "pro",
  }),
  [],
);

assert.deepEqual(
  names({
    provider: "stripe",
    eventType: "customer.subscription.updated",
    status: "active",
    previousStatus: "past_due",
    plan: "pro",
  }),
  [],
);

const scheduled = subscriptionLifecycleCaptures({
  provider: "stripe",
  eventType: "customer.subscription.updated",
  status: "active",
  previousStatus: "active",
  cancelAtPeriodEnd: true,
  previousCancelAtPeriodEnd: false,
  plan: "pro",
});
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0].event, "subscription_cancelled");
assert.equal(scheduled[0].properties.at_period_end, true);

const deleted = subscriptionLifecycleCaptures({
  provider: "stripe",
  eventType: "customer.subscription.deleted",
  status: "canceled",
  previousStatus: "active",
  cancelAtPeriodEnd: true,
  previousCancelAtPeriodEnd: true,
  plan: "pro_plus",
});
assert.equal(deleted.length, 1);
assert.equal(deleted[0].event, "subscription_cancelled");
assert.equal(deleted[0].properties.at_period_end, false);

assert.deepEqual(
  names({
    provider: "stripe",
    eventType: "customer.subscription.updated",
    status: "canceled",
    previousStatus: "active",
    cancelAtPeriodEnd: true,
    previousCancelAtPeriodEnd: false,
    plan: "pro",
  }),
  ["subscription_cancelled"],
);

assert.deepEqual(
  names({
    provider: "apple",
    eventType: "SUBSCRIBED",
    offerType: 1,
    plan: "pro",
  }),
  ["subscription_started"],
);

assert.deepEqual(
  names({
    provider: "apple",
    eventType: "SUBSCRIBED",
    offerType: null,
    plan: "pro_plus",
  }),
  ["subscription_purchased"],
);

assert.deepEqual(
  names({
    provider: "apple",
    eventType: "SUBSCRIBED",
    offerType: 2,
    plan: "pro",
  }),
  ["subscription_purchased"],
);

assert.deepEqual(
  names({
    provider: "apple",
    eventType: "DID_RENEW",
    plan: "pro",
  }),
  [],
);

for (const eventType of ["EXPIRED", "GRACE_PERIOD_EXPIRED", "REFUND", "REVOKE"]) {
  assert.deepEqual(
    names({ provider: "apple", eventType, plan: "pro" }),
    ["subscription_cancelled"],
  );
}

assert.deepEqual(
  names({
    provider: "apple",
    eventType: "DID_CHANGE_RENEWAL_STATUS",
    plan: "pro",
  }),
  [],
);

assert.equal(
  subscriptionLifecycleCaptures({
    provider: "stripe",
    eventType: "customer.subscription.created",
    status: "active",
    plan: "free",
  })[0].properties.plan,
  "unknown",
);

const lifecycle = readFileSync("lib/analytics/subscriptionLifecycle.ts", "utf8");
assert.doesNotMatch(lifecycle, /originalTransactionId|account_number|routing|card_number/);

const events = readFileSync("lib/analytics/events.ts", "utf8");
assert.match(events, /APP_OPENED: "app_opened"/);

const finance = readFileSync("context/FinanceContext.tsx", "utf8");
assert.doesNotMatch(finance, /allocation_count/);
assert.match(finance, /trackFirstBudget\("paycheck"/);

const onboarding = readFileSync(
  "components/onboarding/GuidedOnboardingExperience.tsx",
  "utf8",
);
assert.doesNotMatch(onboarding, /CREATED_INCOME_PLAN/);
assert.doesNotMatch(onboarding, /CREATED_GOAL/);
assert.match(onboarding, /COMPLETED_ONBOARDING/);

const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
assert.match(webhook, /subscriptionLifecycleCaptures/);
assert.match(webhook, /\.select\("id"\)/);

const apple = readFileSync("lib/iap/appleNotificationHandler.ts", "utf8");
const appleCapture = apple.slice(apple.indexOf("subscriptionLifecycleCaptures({"));
assert.match(apple, /subscriptionLifecycleCaptures/);
assert.doesNotMatch(appleCapture, /originalTransactionId|transactionId|signedPayload/);

const client = readFileSync("lib/analytics/client.ts", "utf8");
assert.match(client, /buxme\.first_open/);
assert.doesNotMatch(client, /balance|account_number|routing/);

console.log("subscription lifecycle ok");
