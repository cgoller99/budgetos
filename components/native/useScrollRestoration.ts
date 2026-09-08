"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isNativeIos } from "@/lib/native/platform";

const STORAGE_PREFIX = "buxme-scroll:";

/**
 * Preserve per-route scroll position inside the Capacitor iOS shell.
 */
export function useScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativeIos()) {
      return;
    }

    const key = `${STORAGE_PREFIX}${pathname}`;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const y = Number(saved);
      if (!Number.isNaN(y)) {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "auto" });
        });
      }
    }

    function persist() {
      sessionStorage.setItem(key, String(window.scrollY || 0));
    }

    window.addEventListener("scroll", persist, { passive: true });
    return () => {
      persist();
      window.removeEventListener("scroll", persist);
    };
  }, [pathname]);
}
