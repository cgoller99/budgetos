"use client";

import type { ReactNode } from "react";
import { PageIntro } from "@/components/guidance/PageIntro";
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

export function TopBar({
  activeHref = "/dashboard",
  title = "Dashboard",
  notificationCenter,
}: TopBarProps) {
  const activeRoute = getNavRoute(activeHref);
  const nativeIos = useNativeIos();

  return (
    <header
      className={cn(
        "relative z-30 flex items-start justify-between gap-4 border-b border-[var(--surface-border)] bg-[var(--background)]/40 px-4 py-5 pt-[calc(1.25rem+env(safe-area-inset-top))] backdrop-blur-sm sm:gap-6 sm:px-6 sm:py-6 lg:px-8 lg:py-6 lg:pt-6",
        nativeIos &&
          "native-top-bar items-center gap-3 border-b border-white/[0.06] bg-[var(--background)]/92 px-4 py-2.5 pt-[calc(0.35rem+env(safe-area-inset-top))] backdrop-blur-xl",
      )}
      data-native-top-bar={nativeIos ? "ios" : undefined}
    >
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl",
            nativeIos && "text-[17px] font-semibold leading-tight tracking-[-0.01em]",
          )}
        >
          {title}
        </h1>
        {!nativeIos ? <PageIntro subtitle={activeRoute?.subtitle} /> : null}
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 sm:gap-4",
          nativeIos && "gap-1.5",
        )}
      >
        {!nativeIos ? <GlobalSearch /> : null}
        {notificationCenter}
        <ProfileMenu />
      </div>
    </header>
  );
}
