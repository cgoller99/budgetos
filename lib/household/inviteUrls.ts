import { getSiteUrl } from "@/lib/supabase/authUrls";

export function getHouseholdInvitePath(token: string): string {
  return `/household/invite/${encodeURIComponent(token)}`;
}

export function getHouseholdInviteUrl(token: string): string {
  return `${getSiteUrl()}${getHouseholdInvitePath(token)}`;
}

export function getLoginUrlForInvite(token: string): string {
  const redirect = getHouseholdInvitePath(token);
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}

export function getRegisterUrlForInvite(token: string, email: string): string {
  const redirect = getHouseholdInvitePath(token);
  return `/register?redirect=${encodeURIComponent(redirect)}&email=${encodeURIComponent(email)}`;
}
