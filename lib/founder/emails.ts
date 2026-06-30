const FOUNDER_EMAIL_SEPARATOR = /[,;]|\s+and\s+/i;

let founderEmails: Set<string> | null = null;

function loadFounderEmails(): Set<string> {
  if (founderEmails) {
    return founderEmails;
  }

  const raw = process.env.FOUNDER_EMAILS?.trim();

  if (!raw) {
    founderEmails = new Set();
    return founderEmails;
  }

  founderEmails = new Set(
    raw
      .split(FOUNDER_EMAIL_SEPARATOR)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  return founderEmails;
}

export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return loadFounderEmails().has(email.trim().toLowerCase());
}

export function isFounderModeEnabled(): boolean {
  return loadFounderEmails().size > 0;
}
