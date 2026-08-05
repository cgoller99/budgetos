"use client";

import { Capacitor } from "@capacitor/core";

export type NativePlatform = "ios" | "android" | "web";

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getNativePlatform(): NativePlatform {
  if (!isNativePlatform()) {
    return "web";
  }

  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") {
    return platform;
  }

  return "web";
}

export function isNativeIos(): boolean {
  return getNativePlatform() === "ios";
}

export function isNativeAndroid(): boolean {
  return getNativePlatform() === "android";
}

/** App Store / Play billing must not open Stripe web checkout inside the shell. */
export function shouldUseNativeStoreBilling(): boolean {
  return isNativeIos();
}

export function getNativeAppInfo(): {
  isNative: boolean;
  platform: NativePlatform;
  usesNativeStoreBilling: boolean;
} {
  const platform = getNativePlatform();
  return {
    isNative: platform !== "web",
    platform,
    usesNativeStoreBilling: platform === "ios",
  };
}
