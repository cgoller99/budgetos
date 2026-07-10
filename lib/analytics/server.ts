import "server-only";

import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@/lib/analytics/events";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.0";

function getPostHogKey(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
}

function getPostHogHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
  );
}

export function isServerAnalyticsEnabled(): boolean {
  return Boolean(getPostHogKey());
}

export async function captureServerEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsEventProperties,
  options?: { distinctId?: string },
): Promise<void> {
  const apiKey = getPostHogKey();
  if (!apiKey) {
    return;
  }

  const host = getPostHogHost().replace(/\/$/, "");
  const distinctId = options?.distinctId?.trim() || "server";

  try {
    const response = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          app_version: APP_VERSION,
          source: "server",
        },
      }),
    });

    if (!response.ok) {
      console.error(
        "[analytics/server] PostHog capture failed",
        response.status,
        await response.text().catch(() => ""),
      );
    }
  } catch (error) {
    console.error("[analytics/server] PostHog capture error", error);
  }
}

export { ANALYTICS_EVENTS };
