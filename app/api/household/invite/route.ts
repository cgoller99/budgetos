import { NextResponse } from "next/server";
import { getEmailConfig } from "@/lib/email/config";
import { sendHouseholdInviteEmail } from "@/lib/email/householdInviteEmail";
import { getSandboxDeliveryError } from "@/lib/email/sandbox";
import { EmailNotConfiguredError } from "@/lib/email/sendEmail";
import { getHouseholdInviteUrl } from "@/lib/household/inviteUrls";
import { getEffectiveEntitlements } from "@/lib/subscription/entitlements.server";
import { mapProfileToSubscription } from "@/lib/stripe/subscriptionMapper";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InviteRequestBody = {
  email?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function loadPendingInvite(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  householdId: string,
  normalizedEmail: string,
) {
  const { data, error } = await supabase
    .from("household_invites")
    .select("id, token, email, created_at")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .ilike("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function POST(request: Request) {
  let createdInviteId: string | null = null;

  try {
    const emailConfig = getEmailConfig();

    if (!emailConfig.isConfigured) {
      throw new EmailNotConfiguredError(emailConfig.configurationError ?? undefined);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as InviteRequestBody;
    const normalizedEmail = normalizeEmail(body.email ?? "");

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Invite email is required." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const subscription = mapProfileToSubscription(profile);
    const entitlements = getEffectiveEntitlements({
      email: user.email ?? profile?.email,
      subscription,
      adminFounderGranted: profile?.admin_founder_granted,
    });

    if (
      process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" &&
      !entitlements.hasProAccess
    ) {
      return NextResponse.json(
        {
          error: "Household collaboration requires Buxme Pro or Pro+.",
          code: "SUBSCRIPTION_REQUIRED",
        },
        { status: 403 },
      );
    }

    let householdId = profile?.household_id ?? null;

    if (!householdId) {
      const { data: membership, error: membershipError } = await supabase
        .from("household_members")
        .select("household_id, role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      householdId = membership?.household_id ?? null;
    }

    if (!householdId) {
      return NextResponse.json(
        { error: "Create a household before sending invites." },
        { status: 400 },
      );
    }

    const { data: household, error: householdError } = await supabase
      .from("households")
      .select("id, name, owner_id")
      .eq("id", householdId)
      .maybeSingle();

    if (householdError) {
      throw householdError;
    }

    if (!household || household.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the household owner can send invites." },
        { status: 403 },
      );
    }

    let existingInvite = await loadPendingInvite(
      supabase,
      household.id,
      normalizedEmail,
    );

    if (!existingInvite) {
      const { data: createdInvite, error: insertError } = await supabase
        .from("household_invites")
        .insert({
          household_id: household.id,
          email: normalizedEmail,
          role: "member",
          invited_by: user.id,
        })
        .select("id, token")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          existingInvite = await loadPendingInvite(
            supabase,
            household.id,
            normalizedEmail,
          );
        } else {
          throw insertError;
        }
      } else {
        createdInviteId = createdInvite.id;
        existingInvite = {
          id: createdInvite.id,
          token: createdInvite.token,
          email: normalizedEmail,
          created_at: new Date().toISOString(),
        };
      }
    }

    const inviteToken = existingInvite?.token ?? null;

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Unable to create household invite." },
        { status: 500 },
      );
    }

    const inviteUrl = getHouseholdInviteUrl(inviteToken);
    const sandboxError = getSandboxDeliveryError(
      normalizedEmail,
      emailConfig.fromEmail,
    );

    if (sandboxError) {
      throw new Error(sandboxError);
    }

    const inviterLabel =
      profile?.email?.trim() ||
      user.email?.trim() ||
      "A Buxme user";

    console.info("[household-invite] Sending email", {
      to: normalizedEmail,
      householdId: household.id,
      resent: Boolean(existingInvite && !createdInviteId),
      inviteUrl,
    });

    const { id: resendId } = await sendHouseholdInviteEmail({
      to: normalizedEmail,
      householdName: household.name,
      inviterLabel,
      inviteToken,
    });

    console.info("[household-invite] Email accepted by Resend", { resendId });

    return NextResponse.json({
      ok: true,
      emailSent: true,
      email: normalizedEmail,
      inviteUrl,
      resent: Boolean(existingInvite && !createdInviteId),
      resendId,
    });
  } catch (error) {
    console.error("[household-invite] Failed to send invite email", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });

    if (createdInviteId) {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.from("household_invites").delete().eq("id", createdInviteId);
      } catch (rollbackError) {
        console.error("[household-invite] Failed to roll back invite row", rollbackError);
      }
    }

    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json(
        {
          error: `${error.message} If you use Vercel, add RESEND_API_KEY to Environment Variables and redeploy.`,
          code: "EMAIL_NOT_CONFIGURED",
          emailAttempted: false,
        },
        { status: 503 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Unable to send household invite.";

    return NextResponse.json(
      {
        error: message,
        code: message.includes("sandbox") ? "RESEND_SANDBOX_BLOCKED" : "EMAIL_SEND_FAILED",
        emailAttempted: true,
      },
      { status: 500 },
    );
  }
}
