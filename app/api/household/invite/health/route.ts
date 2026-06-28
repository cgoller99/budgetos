import { NextResponse } from "next/server";
import { getEmailConfig } from "@/lib/email/config";
import { getResendSandboxAccountEmail, isResendSandboxFrom } from "@/lib/email/sandbox";
import { getSiteUrl } from "@/lib/supabase/authUrls";

export async function GET() {
  const config = getEmailConfig();

  return NextResponse.json({
    emailConfigured: config.isConfigured,
    configurationError: config.configurationError,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    siteUrl: getSiteUrl(),
    resendSandbox: isResendSandboxFrom(config.fromEmail),
    sandboxAccountEmail: getResendSandboxAccountEmail(),
    vercel: Boolean(process.env.VERCEL),
    nodeEnv: process.env.NODE_ENV,
  });
}
