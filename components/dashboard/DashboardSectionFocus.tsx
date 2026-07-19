"use client";

import { useEffect } from "react";
import { useFinance } from "@/context/FinanceContext";
import { scrollToDashboardSection } from "@/lib/ui/dashboardSections";

export function DashboardSectionFocus() {
  const {
    isLoading,
    dashboardSectionRequest,
    consumeDashboardSectionRequest,
  } = useFinance();

  useEffect(() => {
    if (!dashboardSectionRequest || isLoading) {
      return;
    }

    const { section } = dashboardSectionRequest;
    const timeout = window.setTimeout(() => {
      scrollToDashboardSection(section);
      consumeDashboardSectionRequest();
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [
    consumeDashboardSectionRequest,
    dashboardSectionRequest,
    isLoading,
  ]);

  return null;
}
