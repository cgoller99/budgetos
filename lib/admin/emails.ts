const ADMIN_EMAIL_SEPARATOR = /[,;]|\s+and\s+/i;

let adminEmails: Set<string> | null = null;

function loadAdminEmails(): Set<string> {
  if (adminEmails) {
    return adminEmails;
  }

  const raw = process.env.ADMIN_EMAILS?.trim();

  if (!raw) {
    adminEmails = new Set();
    return adminEmails;
  }

  adminEmails = new Set(
    raw
      .split(ADMIN_EMAIL_SEPARATOR)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  return adminEmails;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return loadAdminEmails().has(email.trim().toLowerCase());
}

export function isAdminModeEnabled(): boolean {
  return loadAdminEmails().size > 0;
}
