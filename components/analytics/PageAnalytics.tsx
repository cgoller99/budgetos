"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_EVENTS, trackEvent, trackPageView } from "@/lib/analytics/client";

export function PageAnalytics({ event }: { event?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!event) return;

    if (event === ANALYTICS_EVENTS.OPENED_DASHBOARD) {
      trackEvent(event, { path: pathname }, { once: true, dedupeKey: `dashboard-${pathname}` });
      return;
    }

    if (event === ANALYTICS_EVENTS.VIEWED_REPORTS) {
      trackEvent(event, { path: pathname }, { once: true, dedupeKey: `reports-${pathname}` });
    }
  }, [event, pathname]);

  return null;
}
