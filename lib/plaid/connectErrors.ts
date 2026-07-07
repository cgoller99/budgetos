import { PLAID_OAUTH_INSTITUTIONS_DASHBOARD_URL } from "@/lib/plaid/constants";
import { PLAID_PRODUCTION_OAUTH_REDIRECT_URI } from "@/lib/plaid/oauth";

function normalizePlaidErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return String(error).toLowerCase();
}

/** Plaid INSTITUTION_REGISTRATION_REQUIRED — not a redirect URI problem. */
export function isPlaidInstitutionRegistrationRequired(error: unknown): boolean {
  const message = normalizePlaidErrorText(error);

  return (
    message.includes("institution_registration_required") ||
    message.includes("register your application with this institution") ||
    message.includes("oauth-institutions") ||
    message.includes("not yet registered to create items for this institution")
  );
}

/** Missing or invalid OAuth redirect URI in Plaid Dashboard. */
export function isPlaidOAuthRedirectMisconfiguration(
  error: unknown,
  status: string | null,
): boolean {
  if (isPlaidInstitutionRegistrationRequired(error)) {
    return false;
  }

  const message = normalizePlaidErrorText(error);

  return (
    message.includes("redirect_uri") ||
    message.includes("invalid_link_token") ||
    message.includes("invalid link token")
  );
}

/** @deprecated Use isPlaidOAuthRedirectMisconfiguration */
export function isPlaidOAuthMisconfigurationExit(
  error: unknown,
  status: string | null,
): boolean {
  return isPlaidOAuthRedirectMisconfiguration(error, status);
}

export function formatPlaidConnectErrorMessage(
  message: string,
  status?: string | null,
): string {
  const error = new Error(message);

  if (isPlaidInstitutionRegistrationRequired(error)) {
    return `${message} Check registration status and next steps at ${PLAID_OAUTH_INSTITUTIONS_DASHBOARD_URL}. Charles Schwab and PNC require additional registration and can take several days.`;
  }

  if (isPlaidOAuthRedirectMisconfiguration(error, status ?? null)) {
    return `${message} Register ${PLAID_PRODUCTION_OAUTH_REDIRECT_URI} in Plaid Dashboard → Team settings → API → Allowed redirect URIs.`;
  }

  return message;
}
