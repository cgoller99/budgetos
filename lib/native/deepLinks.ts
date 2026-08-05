/**
 * Deep-link path helpers shared by Capacitor runtime and unit tests.
 * Custom schemes: buxme://auth/callback, buxme://oauth/plaid
 * Universal Links: https://buxme.co/...
 */

export const NATIVE_URL_SCHEME = "buxme";
export const PRODUCTION_ORIGIN = "https://buxme.co";

export function toAppPathFromDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === `${NATIVE_URL_SCHEME}:`) {
      const host = parsed.hostname || "";
      const path = parsed.pathname || "";
      const combined = `/${[host, path.replace(/^\//, "")]
        .filter(Boolean)
        .join("/")}`.replace(/\/+/g, "/");
      return `${combined}${parsed.search}${parsed.hash}`;
    }

    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "buxme.co" || parsed.hostname === "www.buxme.co")
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return null;
  } catch {
    return null;
  }
}

/** HTTPS auth callback used in emails (Universal Links open the iOS app). */
export function getWebAuthCallbackUrl(nextPath: string): string {
  const next =
    nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/onboarding";
  return `${PRODUCTION_ORIGIN}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Custom-scheme auth callback for native-only handoffs. */
export function getNativeAuthCallbackUrl(nextPath: string): string {
  const next =
    nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/onboarding";
  return `${NATIVE_URL_SCHEME}://auth/callback?next=${encodeURIComponent(next)}`;
}

export function getNativePlaidOAuthUrl(query = ""): string {
  const suffix = query
    ? query.startsWith("?")
      ? query
      : `?${query}`
    : "";
  return `${NATIVE_URL_SCHEME}://oauth/plaid${suffix}`;
}
