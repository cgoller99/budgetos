/**
 * Shared helper for same-path Settings deep-link navigation on Capacitor iOS.
 * Next.js often no-ops Link clicks when only the hash changes on `/settings`.
 */
export function navigateSettingsDeepLink(href: string, pathname: string): boolean {
  const [hrefPath, hrefHash = ""] = href.split("#");
  if (hrefPath !== pathname) {
    return false;
  }

  if (typeof window === "undefined") {
    return true;
  }

  const nextUrl = hrefHash ? `${hrefPath}#${hrefHash}` : hrefPath;
  window.history.replaceState(null, "", nextUrl);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  return true;
}
