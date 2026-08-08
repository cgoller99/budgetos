"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

type IosPageHeaderProps = {
  title: ReactNode;
  trailing?: ReactNode;
  className?: string;
  /** Home uses the brand wordmark treatment. */
  brand?: boolean;
};

/**
 * Shared native iOS chrome header.
 * Owns safe-area inset, title alignment, and utility control slots so
 * secondary routes cannot collide with the status bar.
 */
export function IosPageHeader({
  title,
  trailing,
  className,
  brand = false,
}: IosPageHeaderProps) {
  return (
    <header
      className={cn(
        "native-top-bar ios-page-header sticky top-0 z-30 flex items-center justify-between gap-3",
        "border-b border-white/[0.04] bg-[var(--background)]/92 px-4 backdrop-blur-xl",
        "pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-2.5",
        className,
      )}
      data-native-top-bar="ios"
      data-ios-page-header="true"
    >
      <div className="min-w-0 flex-1">
        {brand ? (
          <p className="text-[20px] font-semibold leading-none tracking-tight text-[var(--foreground)]">
            {title}
          </p>
        ) : (
          <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[var(--foreground)]">
            {title}
          </h1>
        )}
      </div>
      {trailing ? (
        <div className="ios-page-header-actions flex shrink-0 items-center gap-1.5">
          {trailing}
        </div>
      ) : null}
    </header>
  );
}
