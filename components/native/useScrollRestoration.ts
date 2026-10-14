"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { isNativeIos } from "@/lib/native/platform";
import {
  recallScrollPosition,
  rememberScrollPosition,
} from "@/lib/native/iosNavigation";

const STORAGE_PREFIX = "buxme-scroll:";

/**
 * Restore the per-route scroll position before paint inside the iOS shell.
 */
export function useScrollRestoration() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!isNativeIos()) {
      return;
    }

    const key = `${STORAGE_PREFIX}${pathname}`;
    const remembered = recallScrollPosition(pathname);
    const stored = remembered ?? Number(sessionStorage.getItem(key));
    if (Number.isFinite(stored) && stored > 0) {
      window.scrollTo({ top: stored, behavior: "auto" });
    }

    let frame = 0;
    function persist() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY || 0;
        rememberScrollPosition(pathname, y);
        sessionStorage.setItem(key, String(y));
      });
    }

    persist();
    window.addEventListener("scroll", persist, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      const y = window.scrollY || 0;
      rememberScrollPosition(pathname, y);
      sessionStorage.setItem(key, String(y));
      window.removeEventListener("scroll", persist);
    };
  }, [pathname]);
}
