"use client";

import { usePathname } from "next/navigation";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { RecurringBillsPrompt } from "@/components/bills/RecurringBillsPrompt";
import { FeedbackCenter } from "@/components/feedback/FeedbackCenter";
import { FinanceSyncAlert } from "@/components/FinanceSyncAlert";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { DashboardSectionFocus } from "@/components/dashboard/DashboardSectionFocus";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { PageTransition } from "@/components/PageTransition";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { getNavRoute, NAV_ROUTES } from "@/lib/navigation";

type AppLayoutProps = {
  children: React.ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const activeRoute = getNavRoute(pathname) ?? NAV_ROUTES[0];

  return (
    <div className="app-shell flex min-h-full flex-1 font-sans text-[var(--foreground)]">
      <DashboardSectionFocus />
      <Sidebar className="hidden lg:flex" activeHref={pathname} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeHref={pathname}
          title={activeRoute.label}
          notificationCenter={<NotificationCenter />}
        />
        <main className="flex-1 overflow-x-hidden px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:py-8 lg:pb-10">
          <DemoModeBanner />
          <FinanceSyncAlert />
          <RecurringBillsPrompt />
          <PageTransition>{children}</PageTransition>
        </main>
        <MobileBottomNav activeHref={pathname} />
        <FeedbackCenter />
      </div>
    </div>
  );
}
