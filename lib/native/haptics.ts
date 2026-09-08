"use client";

import { isNativeIos } from "@/lib/native/platform";

export type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

export async function triggerHaptic(style: HapticStyle = "light"): Promise<void> {
  if (!isNativeIos()) {
    return;
  }

  try {
    const { Haptics, ImpactStyle, NotificationType } = await import(
      "@capacitor/haptics"
    );

    if (style === "selection") {
      await Haptics.selectionChanged();
      return;
    }

    if (style === "success" || style === "warning" || style === "error") {
      await Haptics.notification({
        type:
          style === "success"
            ? NotificationType.Success
            : style === "warning"
              ? NotificationType.Warning
              : NotificationType.Error,
      });
      return;
    }

    await Haptics.impact({
      style:
        style === "heavy"
          ? ImpactStyle.Heavy
          : style === "medium"
            ? ImpactStyle.Medium
            : ImpactStyle.Light,
    });
  } catch {
    // Haptics unavailable in simulator / web.
  }
}
