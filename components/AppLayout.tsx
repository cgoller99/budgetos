"use client";

import { usePathname } from "next/navigation";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { FinanceSyncAlert } from "@/components/FinanceSyncAlert";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
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
      <Sidebar className="hidden lg:flex" activeHref={pathname} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeHref={pathname}
          title={activeRoute.label}
          notificationCenter={<NotificationCenter />}
        />
        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-12">
          <DemoModeBanner />
          <FinanceSyncAlert />
          {children}
        </main>
      </div>
    </div>
  );
}
