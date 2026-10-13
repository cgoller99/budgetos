"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { IOS_PRIMARY_NAV } from "@/lib/mobile/navigation";
import {
  consumeIosNavigation,
  markIosNavigation,
  peekIosNavigation,
  resolveIosNavigationKind,
  type IosNavigationKind,
} from "@/lib/native/iosNavigation";
import { cn } from "@/components/ui/cn";

type PageTransitionProps = {
  children: ReactNode;
};

const PRIMARY_HREFS = IOS_PRIMARY_NAV.map((route) => route.href);

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const nativeIos = useNativeIos();
  const path = pathname.split("?")[0] ?? pathname;
  const [kind, setKind] = useState<IosNavigationKind>("tab");
  const [trackedPath, setTrackedPath] = useState(path);

  if (path !== trackedPath) {
    const priorPath = trackedPath;
    setTrackedPath(path);
    setKind(
      resolveIosNavigationKind({
        marked: peekIosNavigation(),
        path,
        previousPath: priorPath,
        primaryHrefs: PRIMARY_HREFS,
      }),
    );
  }

  useLayoutEffect(() => {
    consumeIosNavigation();
    const onPop = () => {
      markIosNavigation("pop");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [path]);

  const motionClass =
    kind === "pop" ? "native-page-back" : kind === "tab" ? "native-tab-enter" : "native-page-enter";

  return (
    <div
      key={pathname}
      className={cn("page-enter", nativeIos && motionClass)}
      data-ios-navigation={nativeIos ? kind : undefined}
    >
      {children}
    </div>
  );
}
