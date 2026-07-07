import { getSiteUrl } from "@/lib/supabase/authUrls";

export const PLAID_PRODUCTION_OAUTH_REDIRECT_URI = "https://buxme.co/oauth/plaid";
export const PLAID_LINK_TOKEN_STORAGE_KEY = "buxme_plaid_link_token";

/** Path registered as redirect URI in Plaid Dashboard → Team Settings → API → Allowed redirect URIs */
export const PLAID_OAUTH_REDIRECT_PATH = "/oauth/plaid";

export function getPlaidOAuthRedirectUri(): string {
  if (process.env.VERCEL_ENV === "production") {
    return PLAID_PRODUCTION_OAUTH_REDIRECT_URI;
  }

  return `${getSiteUrl()}${PLAID_OAUTH_REDIRECT_PATH}`;
}

export function isPlaidOAuthReturn(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname === PLAID_OAUTH_REDIRECT_PATH &&
      parsed.searchParams.has("oauth_state_id")
    );
  } catch {
    return false;
  }
}

export function isPlaidOAuthHandoffExit(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }

  const normalized = status.toLowerCase();
  return (
    normalized.includes("oauth") ||
    normalized === "requires_oauth" ||
    normalized === "choose_device"
  );
}

export function readStoredPlaidLinkToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem(PLAID_LINK_TOKEN_STORAGE_KEY) ??
    window.sessionStorage.getItem(PLAID_LINK_TOKEN_STORAGE_KEY)
  );
}

export function storePlaidLinkToken(linkToken: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PLAID_LINK_TOKEN_STORAGE_KEY, linkToken);
  window.sessionStorage.setItem(PLAID_LINK_TOKEN_STORAGE_KEY, linkToken);
}

export function clearStoredPlaidLinkToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PLAID_LINK_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(PLAID_LINK_TOKEN_STORAGE_KEY);
}
