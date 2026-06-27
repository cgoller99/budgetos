type PostgrestErrorLike = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

function isPostgrestErrorLike(error: unknown): error is PostgrestErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    ("message" in error || "code" in error || "details" in error)
  );
}

export function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (isPostgrestErrorLike(error)) {
    const parts = [
      error.message,
      error.details,
      error.hint,
      error.code ? `[${error.code}]` : null,
    ].filter((part): part is string => Boolean(part && String(part).trim()));

    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  return "Something went wrong while syncing with Supabase.";
}

export function getErrorMessage(error: unknown): string {
  return formatSupabaseError(error);
}
