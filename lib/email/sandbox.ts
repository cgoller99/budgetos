const SANDBOX_FROM_SUFFIX = "@resend.dev";

export function isResendSandboxFrom(fromEmail: string): boolean {
  return fromEmail.trim().toLowerCase().endsWith(SANDBOX_FROM_SUFFIX);
}

export function getResendSandboxAccountEmail(): string | null {
  const value = process.env.RESEND_SANDBOX_ACCOUNT_EMAIL?.trim().toLowerCase();
  return value || null;
}

export function getSandboxDeliveryError(
  to: string,
  fromEmail: string,
): string | null {
  if (!isResendSandboxFrom(fromEmail)) {
    return null;
  }

  const allowedRecipient = getResendSandboxAccountEmail();

  if (allowedRecipient && to.trim().toLowerCase() === allowedRecipient) {
    return null;
  }

  if (allowedRecipient) {
    return `Resend sandbox (${fromEmail}) can only deliver to ${allowedRecipient}. To invite ${to}, verify a domain at resend.com/domains and update RESEND_FROM_EMAIL.`;
  }

  return `Resend sandbox (${fromEmail}) can only deliver to the email on your Resend account. To invite ${to}, set RESEND_SANDBOX_ACCOUNT_EMAIL in env or verify a domain at resend.com/domains.`;
}

export function parseResendErrorMessage(body: unknown, rawBody: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return rawBody;
}

export function isResendSandboxRestrictionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("only send testing emails to your own email") ||
    normalized.includes("verify a domain at resend.com/domains")
  );
}
