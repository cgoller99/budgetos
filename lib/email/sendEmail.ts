import { getEmailConfig } from "@/lib/email/config";
import {
  isResendSandboxRestrictionError,
  parseResendErrorMessage,
} from "@/lib/email/sandbox";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export class EmailNotConfiguredError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment.",
    );
    this.name = "EmailNotConfiguredError";
  }
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const { isConfigured, apiKey, fromEmail, fromName, configurationError } =
    getEmailConfig();

  if (!isConfigured || !apiKey) {
    throw new EmailNotConfiguredError(configurationError ?? undefined);
  }

  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  };

  console.info("[email] Sending via Resend", {
    to: input.to,
    from: payload.from,
    subject: input.subject,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let parsedBody: unknown = rawBody;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    // keep raw text
  }

  console.info("[email] Resend response", {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: parsedBody,
  });

  if (!response.ok) {
    const detail = parseResendErrorMessage(parsedBody, rawBody);

    if (response.status === 403 && isResendSandboxRestrictionError(detail)) {
      throw new Error(
        `Resend sandbox blocked this invite (${response.status}): ${detail}`,
      );
    }

    throw new Error(
      `Resend rejected email (${response.status} ${response.statusText}): ${detail}`,
    );
  }

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    !("id" in parsedBody) ||
    typeof parsedBody.id !== "string"
  ) {
    throw new Error(`Resend returned an unexpected success payload: ${rawBody}`);
  }

  return { id: parsedBody.id };
}
