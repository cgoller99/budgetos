export const DASHBOARD_SECTIONS = {
  weeklyPlan: "weekly-plan",
} as const;

export type DashboardSectionId =
  (typeof DASHBOARD_SECTIONS)[keyof typeof DASHBOARD_SECTIONS];

export function scrollToDashboardSection(sectionId: DashboardSectionId): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
}
