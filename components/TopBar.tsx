"use client";

import type { ReactNode } from "react";
import { PageIntro } from "@/components/guidance/PageIntro";
import { IosPageHeader } from "@/components/native/ios/IosPageHeader";
import { ProfileMenu } from "@/components/navigation/ProfileMenu";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { getNavRoute } from "@/lib/navigation";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

type TopBarProps = {
  activeHref?: string;
  title?: string;
  notificationCenter?: ReactNode;
};

function resolveIosTitle(path: string, title: string): string {
  if (path === "/dashboard") return "Home";
  if (path === "/transactions") return "Transactions";
  if (path === "/savings") return "Goals";
  if (path === "/whats-new") return "What's New";
  return title;
}

export function TopBar({
  activeHref = "/dashboard",
  title = "Dashboard",
  notificationCenter,
}: TopBarProps) {
  const activeRoute = getNavRoute(activeHref);
  const nativeIos = useNativeIos();
  const path = activeHref.split("?")[0] ?? activeHref;
  const isHome = path === "/dashboard";
  const iosTitle = resolveIosTitle(path, title);

  if (nativeIos) {
    return (
      <IosPageHeader
        brand={isHome}
        title={
          isHome ? (
            <>
              <span className="text-[var(--accent-light)]">bux</span>me
            </>
          ) : (
            iosTitle
          )
        }
        trailing={
          <>
            {notificationCenter}
            {isHome ? null : <ProfileMenu />}
          </>
        }
      />
    );
  }

  return (
    <header
      className={cn(
        "relative z-30 flex items-start justify-between gap-4 border-b border-[var(--surface-border)] bg-[var(--background)]/40 px-4 py-5 pt-[calc(1.25rem+env(safe-area-inset-top))] backdrop-blur-sm sm:gap-6 sm:px-6 sm:py-6 lg:px-8 lg:py-6 lg:pt-6",
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl">
          {title}
        </h1>
        <PageIntro subtitle={activeRoute?.subtitle} />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <GlobalSearch />
        {notificationCenter}
        <ProfileMenu />
      </div>
    </header>
  );
}
