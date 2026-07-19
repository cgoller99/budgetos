"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFinance } from "@/context/FinanceContext";
import {
  DASHBOARD_SECTIONS,
  retryScrollToDashboardSection,
} from "@/lib/ui/dashboardSections";

export function DashboardSectionFocus() {
  const pathname = usePathname();
  const {
    isLoading,
    dashboardSectionRequest,
    consumeDashboardSectionRequest,
  } = useFinance();

  useEffect(() => {
    if (pathname !== "/dashboard" || !dashboardSectionRequest || isLoading) {
      return;
    }

    const { section } = dashboardSectionRequest;

    if (section === DASHBOARD_SECTIONS.weeklyPlan) {
      window.history.replaceState(null, "", `/dashboard#${section}`);
    }

    retryScrollToDashboardSection(section);
    consumeDashboardSectionRequest();
  }, [
    consumeDashboardSectionRequest,
    dashboardSectionRequest,
    isLoading,
    pathname,
  ]);

  return null;
}
