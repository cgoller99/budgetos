export const DASHBOARD_SECTIONS = {
  weeklyPlan: "weekly-plan",
} as const;

export type DashboardSectionId =
  (typeof DASHBOARD_SECTIONS)[keyof typeof DASHBOARD_SECTIONS];

export function scrollToDashboardSection(sectionId: DashboardSectionId): void {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function retryScrollToDashboardSection(
  sectionId: DashboardSectionId,
  maxAttempts = 40,
  intervalMs = 75,
): void {
  let attempts = 0;

  const tryScroll = () => {
    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    attempts += 1;

    if (attempts < maxAttempts) {
      window.setTimeout(tryScroll, intervalMs);
    }
  };

  window.requestAnimationFrame(tryScroll);
}

export function isWeeklySummaryNotification(input: {
  eventType?: string;
  title: string;
  subtitle: string;
}): boolean {
  return (
    input.eventType === "weekly_summary_ready" ||
    input.title.includes("Weekly Summary") ||
    input.subtitle.includes("This Week's Plan")
  );
}

export function getWeeklyPlanHref(): string {
  return `/dashboard#${DASHBOARD_SECTIONS.weeklyPlan}`;
}

export function focusWeeklyPlanSection(): void {
  window.history.replaceState(null, "", getWeeklyPlanHref());
  retryScrollToDashboardSection(DASHBOARD_SECTIONS.weeklyPlan);
}
