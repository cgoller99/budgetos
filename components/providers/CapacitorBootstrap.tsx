"use client";

import { useEffect } from "react";
import {
  configureNativeChrome,
  registerNativeLifecycle,
} from "@/lib/native/capacitorRuntime";
import { isNativePlatform } from "@/lib/native/platform";

/**
 * Boots Capacitor plugins when the web app is running inside the native shell.
 * Safe no-op on the regular web deployment.
 */
export function CapacitorBootstrap() {
  useEffect(() => {
    if (!isNativePlatform()) {
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      await configureNativeChrome();
      if (disposed) {
        return;
      }
      cleanup = await registerNativeLifecycle();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return null;
}
