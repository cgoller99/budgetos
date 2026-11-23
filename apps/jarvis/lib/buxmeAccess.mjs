export const JARVIS_ADMIN_EMAIL = "christiangoller99@gmail.com";

function emailOf(record) {
  return String(record?.email ?? "").trim().toLowerCase();
}

/**
 * @param {{ sessionUser?: { id?: string, email?: string | null } | null, authUser?: { id?: string, email?: string | null } | null, profile?: { id?: string, email?: string | null } | null, adminAuthorized?: boolean }} input
 * @returns {{ ok: true, userId: string, email: string } | { ok: false, status: 401 | 403, error: string }}
 */
export function decideJarvisAdmin({ sessionUser, authUser, profile, adminAuthorized }) {
  if (!sessionUser?.id) return deny(401, "Sign in to Buxme first.");
  if (!authUser?.id || authUser.id !== sessionUser.id) return deny(403, "The Buxme account could not be confirmed.");
  const email = emailOf(authUser);
  const sessionEmail = emailOf(sessionUser);
  if (!email || email !== JARVIS_ADMIN_EMAIL || sessionEmail !== email) return deny(403, "This Buxme account cannot open Jarvis.");
  if (adminAuthorized !== true) return deny(403, "This account is not authorized as a Buxme admin.");
  if (!profile?.id || profile.id !== sessionUser.id) return deny(403, "This Buxme account has no profile.");
  const profileEmail = emailOf(profile);
  if (profileEmail && profileEmail !== email) return deny(403, "This Buxme account could not be confirmed.");
  return { ok: true, userId: sessionUser.id, email };
}

function deny(status, error) {
  return { ok: false, status, error };
}
