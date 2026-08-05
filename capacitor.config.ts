import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Buxme uses a remote-URL Capacitor shell.
 *
 * Next.js (App Router + API routes + SSR auth) cannot be fully statically
 * exported into webDir without breaking Plaid/Stripe/Supabase server flows.
 * The native app therefore loads the production web app and layers native
 * plugins (deep links, keyboard, status bar, StoreKit) on top.
 *
 * webDir still requires a local folder for Capacitor sync; native/www is a
 * minimal placeholder shell, not the product UI.
 */
const config: CapacitorConfig = {
  appId: "co.buxme.app",
  appName: "Buxme",
  webDir: "native/www",
  server: {
    url: "https://buxme.co",
    cleartext: false,
    allowNavigation: [
      "buxme.co",
      "*.buxme.co",
      "*.supabase.co",
      "*.stripe.com",
      "*.plaid.com",
      "*.stripe.network",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0b0f14",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0f14",
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#0b0f14",
    scheme: "Buxme",
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
