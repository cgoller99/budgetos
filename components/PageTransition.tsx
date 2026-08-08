"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const nativeIos = useNativeIos();

  return (
    <div
      key={pathname}
      className={cn("page-enter", nativeIos && "native-page-enter")}
    >
      {children}
    </div>
  );
}
