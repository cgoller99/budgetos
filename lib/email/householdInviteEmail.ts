import { sendEmail } from "@/lib/email/sendEmail";
import { getHouseholdInviteUrl } from "@/lib/household/inviteUrls";

export type HouseholdInviteEmailInput = {
  to: string;
  householdName: string;
  inviterLabel: string;
  inviteToken: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendHouseholdInviteEmail(
  input: HouseholdInviteEmailInput,
): Promise<{ id: string }> {
  const inviteUrl = getHouseholdInviteUrl(input.inviteToken);
  const householdName = escapeHtml(input.householdName);
  const inviterLabel = escapeHtml(input.inviterLabel);
  const inviteEmail = escapeHtml(input.to);

  const subject = `You're invited to join ${input.householdName} on Buxme`;

  const text = [
    `${input.inviterLabel} invited you to join "${input.householdName}" on Buxme.`,
    "",
    "Open this link to sign in or create an account, then accept the invite:",
    inviteUrl,
    "",
    `This invite was sent to ${input.to} and expires in 14 days.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0f1a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent);">Buxme</p>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#ffffff;">You're invited to a shared household</h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:rgba(255,255,255,0.72);">
                  ${inviterLabel} invited you to join <strong style="color:#ffffff;">${householdName}</strong> on Buxme.
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.55);">
                  Accept the invite to share accounts, bills, goals, debts, and dashboard data with your partner.
                </p>
                <a href="${inviteUrl}" style="display:inline-block;background:var(--accent);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 22px;border-radius:14px;">
                  View invite
                </a>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.38);">
                  This invite was sent to ${inviteEmail}. If you don't have an account yet, you'll create one first, then accept the invite. The link expires in 14 days.
                </p>
                <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.28);word-break:break-all;">
                  ${inviteUrl}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}
