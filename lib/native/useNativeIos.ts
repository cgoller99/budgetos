"use client";

import { useEffect, useState } from "react";
import { isNativeIos } from "@/lib/native/platform";

/**
 * Safe for SSR/hydration: always false on the server and first client paint,
 * then true after mount when running inside the Capacitor iOS shell.
 */
export function useNativeIos(): boolean {
  const [nativeIos, setNativeIos] = useState(false);

  useEffect(() => {
    setNativeIos(isNativeIos());
  }, []);

  return nativeIos;
}
