"use client";

import posthog from "posthog-js";
import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "@/lib/analytics/events";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.0";
const dedupeKeys = new Set<string>();

let initialized = false;

function getPostHogKey(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
}

function getPostHogHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(getPostHogKey());
}

export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") {
    return;
  }

  const key = getPostHogKey();
  if (!key) {
    return;
  }

  posthog.init(key, {
    api_host: getPostHogHost(),
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: false,
    disable_session_recording: true,
    loaded: (client) => {
      if (process.env.NODE_ENV === "development") {
        client.debug(false);
      }
    },
  });

  initialized = true;
}

export function identifyAnalyticsUser(input: {
  id: string;
  email?: string | null;
  name?: string | null;
}): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  initAnalytics();
  posthog.identify(input.id, {
    email: input.email ?? undefined,
    name: input.name ?? undefined,
    app_version: APP_VERSION,
  });
}

export function resetAnalyticsUser(): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  dedupeKeys.clear();
  posthog.reset();
}

export function trackEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsEventProperties,
  options?: { dedupeKey?: string; once?: boolean },
): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  initAnalytics();

  const dedupeKey = options?.dedupeKey ?? (options?.once ? event : undefined);
  if (dedupeKey && dedupeKeys.has(dedupeKey)) {
    return;
  }

  if (dedupeKey) {
    dedupeKeys.add(dedupeKey);
  }

  posthog.capture(event, {
    ...properties,
    app_version: APP_VERSION,
  });
}

export function trackPageView(path: string): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  initAnalytics();
  posthog.capture("$pageview", { path, app_version: APP_VERSION });
}

export { ANALYTICS_EVENTS, APP_VERSION };
