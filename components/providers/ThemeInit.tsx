"use client";

import { useEffect } from "react";
import { initTheme } from "@/lib/theme/preferences";

export function ThemeInit() {
  useEffect(() => {
    initTheme();
  }, []);

  return null;
}
