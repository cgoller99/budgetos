/** Sanitize post-auth redirect paths from email links. */
export function sanitizeAuthNextPath(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/onboarding";
}

/** Site origin for Supabase email redirect links. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

/** OAuth / email confirmation / password recovery callback URL. */
export function getAuthCallbackUrl(nextPath: string): string {
  const next =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/onboarding";

  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Alternate callback path used by some Supabase email templates. */
export function getAuthConfirmUrl(nextPath: string): string {
  const next =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/onboarding";

  return `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`;
}
