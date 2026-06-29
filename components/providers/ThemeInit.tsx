"use client";

import { useEffect } from "react";
import { initTheme, subscribeToSystemTheme } from "@/lib/theme/preferences";

export function ThemeInit() {
  useEffect(() => {
    initTheme();
    return subscribeToSystemTheme();
  }, []);

  return null;
}
