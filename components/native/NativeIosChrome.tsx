"use client";

import { useEffect, useState } from "react";
import { useNativeIos } from "@/lib/native/useNativeIos";

function isEditableField(target: EventTarget | null): target is HTMLElement {
  return (
    target instanceof HTMLElement &&
    target.matches("input, textarea, select, [contenteditable='true']")
  );
}

function revealFocusedField(target: HTMLElement) {
  const viewport = window.visualViewport;
  const topInset = viewport?.offsetTop ?? 0;
  const visibleBottom = (viewport?.height ?? window.innerHeight) + topInset;
  const rect = target.getBoundingClientRect();
  const obscured = rect.bottom > visibleBottom - 12 || rect.top < topInset + 12;
  if (!obscured) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

export function NativeIosChrome() {
  const nativeIos = useNativeIos();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!nativeIos) return;

    const syncConnection = () => {
      setOffline(navigator.onLine === false);
    };
    syncConnection();
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditableField(event.target)) return;
      const field = event.target;
      window.setTimeout(() => revealFocusedField(field), 280);
    };
    const onViewportResize = () => {
      if (isEditableField(document.activeElement)) {
        revealFocusedField(document.activeElement);
      }
    };

    document.addEventListener("focusin", onFocusIn);
    window.visualViewport?.addEventListener("resize", onViewportResize);

    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
      document.removeEventListener("focusin", onFocusIn);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
    };
  }, [nativeIos]);

  if (!nativeIos || !offline) return null;

  return (
    <p
      role="status"
      className="mb-3 rounded-[10px] bg-white/[0.06] px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)]"
    >
      You are offline. Buxme will refresh when the connection returns.
    </p>
  );
}
