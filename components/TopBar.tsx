import type { ReactNode } from "react";
import { PageIntro } from "@/components/guidance/PageIntro";
import { ProfileMenu } from "@/components/navigation/ProfileMenu";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { getNavRoute } from "@/lib/navigation";

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

  return (
    <>
      <header className="relative z-20 flex items-start justify-between gap-4 border-b border-[var(--surface-border)] bg-[var(--background)]/40 px-4 py-5 pt-[calc(1.25rem+env(safe-area-inset-top))] backdrop-blur-sm sm:gap-6 sm:px-6 sm:py-6 lg:px-8 lg:py-6 lg:pt-6">
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
    </>
  );
}
