"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { IOS_PRIMARY_NAV } from "@/lib/mobile/navigation";
import { cn } from "@/components/ui/cn";

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const nativeIos = useNativeIos();
  const path = pathname.split("?")[0] ?? pathname;
  const isPrimaryTab = IOS_PRIMARY_NAV.some((route) => route.href === path);

  return (
    <div
      key={pathname}
      className={cn(
        "page-enter",
        nativeIos && (isPrimaryTab ? "native-tab-enter" : "native-page-enter"),
      )}
    >
      {children}
    </div>
  );
}
