"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { RecurringBillsPrompt } from "@/components/bills/RecurringBillsPrompt";
import { FeedbackCenter } from "@/components/feedback/FeedbackCenter";
import { FinanceSyncAlert } from "@/components/FinanceSyncAlert";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { DashboardSectionFocus } from "@/components/dashboard/DashboardSectionFocus";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { PageTransition } from "@/components/PageTransition";
import { PullToRefresh } from "@/components/native/PullToRefresh";
import { useScrollRestoration } from "@/components/native/useScrollRestoration";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { cn } from "@/components/ui/cn";
import { getNavRoute, NAV_ROUTES } from "@/lib/navigation";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { useFinance } from "@/context/FinanceContext";

type AppLayoutProps = {
  children: React.ReactNode;
};

const REFRESHABLE_PATHS = new Set([
  "/dashboard",
  "/accounts",
  "/transactions",
  "/bills",
  "/income",
  "/savings",
  "/debt",
  "/investments",
  "/reports",
  "/calendar",
  "/settings",
]);

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeRoute = getNavRoute(pathname) ?? NAV_ROUTES[0];
  const nativeIos = useNativeIos();
  const { refreshFinance } = useFinance();
  useScrollRestoration();

  const path = pathname.split("?")[0] ?? pathname;
  const canPullRefresh = nativeIos && REFRESHABLE_PATHS.has(path);

  const handleRefresh = useCallback(async () => {
    await refreshFinance();
    router.refresh();
  }, [refreshFinance, router]);

  const content = (
    <>
      <DemoModeBanner />
      <FinanceSyncAlert />
      <RecurringBillsPrompt />
      <PageTransition>{children}</PageTransition>
    </>
  );

  return (
    <div
      className={cn(
        "app-shell flex min-h-full flex-1 font-sans text-[var(--foreground)]",
        nativeIos && "native-ios-shell",
      )}
      data-native-shell={nativeIos ? "ios" : undefined}
    >
      <DashboardSectionFocus />
      <Sidebar className="hidden lg:flex" activeHref={pathname} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeHref={pathname}
          title={activeRoute.label}
          notificationCenter={<NotificationCenter />}
        />
        <main
          className={cn(
            "flex-1 overflow-x-hidden px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:py-8 lg:pb-10",
            nativeIos &&
              "native-main px-3 py-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:px-3 sm:py-3",
          )}
        >
          {canPullRefresh ? (
            <PullToRefresh onRefresh={handleRefresh}>{content}</PullToRefresh>
          ) : (
            content
          )}
        </main>
        <MobileBottomNav activeHref={pathname} />
        {/* Keep mounted so More → Support can open the modal; FAB is desktop-only. */}
        <FeedbackCenter />
      </div>
    </div>
  );
}
