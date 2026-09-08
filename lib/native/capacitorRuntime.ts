"use client";

import { App as CapApp, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  PRODUCTION_ORIGIN,
  toAppPathFromDeepLink,
} from "@/lib/native/deepLinks";
import { isNativeIos, isNativePlatform } from "@/lib/native/platform";

async function navigateInApp(path: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const target = path.startsWith("/") ? path : `/${path}`;

  if (window.location.pathname + window.location.search + window.location.hash !== target) {
    window.location.assign(target);
  }
}

export async function configureNativeChrome(): Promise<void> {
  if (!isNativePlatform()) {
    return;
  }

  document.documentElement.dataset.native = "true";
  document.documentElement.dataset.nativePlatform = isNativeIos()
    ? "ios"
    : "android";
  document.documentElement.classList.add("native-app");
  if (isNativeIos()) {
    document.documentElement.classList.add("native-ios");
  }

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (isNativeIos()) {
      // Overlay so TopBar/tab bar own safe-area insets (no double body padding).
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    // Status bar plugin unavailable in some simulators.
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Splash already hidden.
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {
    // Resize mode may be unavailable on some platforms.
  }
}

export async function registerNativeLifecycle(): Promise<() => void> {
  if (!isNativePlatform()) {
    return () => undefined;
  }

  try {
    const launch = await CapApp.getLaunchUrl();
    if (launch?.url) {
      const path = toAppPathFromDeepLink(launch.url);
      if (path) {
        void navigateInApp(path);
      }
    }
  } catch {
    // Launch URL unavailable.
  }

  const listeners = await Promise.all([
    CapApp.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
      const path = toAppPathFromDeepLink(event.url);
      if (path) {
        void navigateInApp(path);
      }
    }),
    CapApp.addListener("appStateChange", ({ isActive }) => {
      document.documentElement.dataset.appActive = isActive ? "true" : "false";
    }),
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void CapApp.exitApp();
      }
    }),
  ]);

  // Open http(s) links that leave the app allowlist in the system browser.
  const clickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor?.href) {
      return;
    }

    try {
      const url = new URL(anchor.href, window.location.href);
      const isSameOrigin =
        url.origin === window.location.origin ||
        url.origin === PRODUCTION_ORIGIN;
      const isCustomScheme = url.protocol === "buxme:";

      if (!isSameOrigin && !isCustomScheme && /^https?:$/.test(url.protocol)) {
        event.preventDefault();
        void Browser.open({ url: url.toString() });
      }
    } catch {
      // Ignore malformed hrefs.
    }
  };

  document.addEventListener("click", clickHandler, true);

  return () => {
    document.removeEventListener("click", clickHandler, true);
    for (const listener of listeners) {
      void listener.remove();
    }
  };
}

export { toAppPathFromDeepLink };
