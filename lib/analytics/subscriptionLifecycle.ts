import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@/lib/analytics/events";

export type SubscriptionLifecycleInput = {
  provider: "stripe" | "apple";
  eventType: string;
  status?: string | null;
  previousStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  previousCancelAtPeriodEnd?: boolean | null;
  plan?: string | null;
  /** Apple offer type. 1 is an introductory offer. */
  offerType?: number | null;
};

export type SubscriptionLifecycleCapture = {
  event: AnalyticsEventName;
  properties: AnalyticsEventProperties;
};

const INTRODUCTORY_OFFER = 1;

function planProperty(plan: string | null | undefined): string {
  if (plan === "pro" || plan === "pro_plus") {
    return plan;
  }

  return "unknown";
}

function cancelled(
  provider: "stripe" | "apple",
  plan: string,
  atPeriodEnd: boolean,
): SubscriptionLifecycleCapture {
  return {
    event: ANALYTICS_EVENTS.SUBSCRIPTION_CANCELLED,
    properties: {
      plan,
      provider,
      at_period_end: atPeriodEnd,
    },
  };
}

/**
 * Decide which subscription analytics events a verified billing notification
 * represents. Callers supply plan names and status flags only.
 */
export function subscriptionLifecycleCaptures(
  input: SubscriptionLifecycleInput,
): SubscriptionLifecycleCapture[] {
  const plan = planProperty(input.plan);
  const provider = input.provider;

  if (provider === "apple") {
    if (input.eventType === "SUBSCRIBED") {
      if (input.offerType === INTRODUCTORY_OFFER) {
        return [
          {
            event: ANALYTICS_EVENTS.SUBSCRIPTION_STARTED,
            properties: { plan, provider, trial: true },
          },
        ];
      }

      return [
        {
          event: ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED,
          properties: { plan, provider },
        },
      ];
    }

    if (
      input.eventType === "EXPIRED" ||
      input.eventType === "GRACE_PERIOD_EXPIRED" ||
      input.eventType === "REFUND" ||
      input.eventType === "REVOKE"
    ) {
      return [cancelled(provider, plan, false)];
    }

    return [];
  }

  const status = input.status ?? "";
  const previousStatus = input.previousStatus ?? "";
  const created = input.eventType === "customer.subscription.created";
  const deleted = input.eventType === "customer.subscription.deleted";
  const ended =
    deleted || (status === "canceled" && previousStatus !== "canceled");
  const scheduled =
    !ended &&
    input.cancelAtPeriodEnd === true &&
    input.previousCancelAtPeriodEnd === false;

  if (ended) {
    return [cancelled(provider, plan, false)];
  }

  if (scheduled) {
    return [cancelled(provider, plan, true)];
  }

  if (
    status === "trialing" &&
    (created || previousStatus === "incomplete")
  ) {
    return [
      {
        event: ANALYTICS_EVENTS.SUBSCRIPTION_STARTED,
        properties: { plan, provider, trial: true },
      },
    ];
  }

  if (
    status === "active" &&
    (created ||
      previousStatus === "trialing" ||
      previousStatus === "incomplete")
  ) {
    return [
      {
        event: ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED,
        properties: { plan, provider },
      },
    ];
  }

  return [];
}
