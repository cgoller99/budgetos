"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  FormField,
  Input,
} from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import { useToast } from "@/context/ToastContext";
import { getHouseholdInviteUrl } from "@/lib/household/inviteUrls";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function HouseholdSection() {
  const {
    household,
    members,
    invites,
    incomingInvites,
    role,
    isLoading,
    isSyncing,
    error,
    createHousehold,
    inviteMember,
    acceptInvite,
  } = useHousehold();
  const { refreshFinance } = useFinance();
  const { showToast } = useToast();
  const [householdName, setHouseholdName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  async function handleCreateHousehold() {
    try {
      await createHousehold(householdName);
      await refreshFinance();
      setHouseholdName("");
      showToast({
        title: "Household created",
        subtitle: "Your existing data is now shared with this household.",
      });
    } catch {
      // Error surfaced in context
    }
  }

  async function handleInviteMember() {
    try {
      const result = await inviteMember(inviteEmail);
      const sentTo = inviteEmail.trim();
      setInviteEmail("");
      showToast({
        title: "Invite sent",
        subtitle: result.resendId
          ? `Resend id ${result.resendId}. Check spam for ${sentTo}.`
          : result.inviteUrl
            ? `Check spam for ${sentTo}.`
            : `We emailed ${sentTo}. Check spam and promotions.`,
      });
    } catch (inviteError) {
      showToast({
        title: "Invite failed",
        subtitle:
          inviteError instanceof Error
            ? inviteError.message
            : "Unable to send household invite.",
      });
    }
  }

  async function handleCopyInviteLink(token: string, email: string) {
    const inviteUrl = getHouseholdInviteUrl(token);
    const copied = await copyText(inviteUrl);

    showToast({
      title: copied ? "Invite link copied" : "Copy this invite link",
      subtitle: copied ? `Share it with ${email}.` : inviteUrl,
    });
  }

  async function handleAcceptInvite(inviteId: string) {
    setAcceptingInviteId(inviteId);

    try {
      await acceptInvite(inviteId);
      await refreshFinance();
      showToast({
        title: "Invite accepted",
        subtitle: "You now share this household's finances.",
      });
    } catch {
      // Error surfaced in context
    } finally {
      setAcceptingInviteId(null);
    }
  }

  if (isLoading) {
    return (
      <Card padding="lg">
        <CardHeader title="Shared household" />
        <CardContent>
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        </CardContent>
      </Card>
    );
  }

  if (!household) {
    return (
      <Card padding="lg">
        <CardHeader title="Shared household" />
        <CardContent className="space-y-4">
          {incomingInvites.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-[#0077ed]/20 bg-[#0077ed]/5 p-4">
              <p className="text-sm font-medium text-white">
                You have a pending household invite
              </p>
              {incomingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm text-white/70">{invite.email}</p>
                    <p className="mt-1 text-xs text-white/40">
                      Accept to share accounts, bills, goals, and dashboard data.
                    </p>
                  </div>
                  <Button
                    onClick={() => void handleAcceptInvite(invite.id)}
                    disabled={isSyncing || acceptingInviteId === invite.id}
                  >
                    {acceptingInviteId === invite.id
                      ? "Joining..."
                      : "Accept invite"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm text-white/55">
            Create a household to share accounts, bills, goals, debts, and your
            dashboard with a spouse or partner.
          </p>
          <FormField label="Household name">
            <Input
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              placeholder="The Morgan Household"
            />
          </FormField>
          {error && (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}
          <Button
            onClick={() => void handleCreateHousehold()}
            disabled={isSyncing || !householdName.trim()}
          >
            {isSyncing ? "Creating..." : "Create household"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Shared household"
        action={
          role ? (
            <Badge variant={role === "owner" ? "accent" : "default"}>
              {role === "owner" ? "Owner" : "Member"}
            </Badge>
          ) : undefined
        }
      />
      <CardContent className="space-y-6">
        <div>
          <p className="text-lg font-semibold text-white">{household.name}</p>
          <p className="mt-1 text-sm text-white/45">
            Both household members can view shared accounts, bills, goals, debts,
            and dashboard data.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-white/70">Members</p>
          {members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description="Invite someone to join your household."
            />
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li
                  key={`${member.householdId}-${member.userId}`}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                >
                  <span className="text-sm text-white/70">
                    {member.email ?? member.userId}
                  </span>
                  <Badge variant={member.role === "owner" ? "accent" : "default"}>
                    {member.role === "owner" ? "Owner" : "Member"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {role === "owner" && (
          <div className="space-y-3">
            <FormField label="Invite by email">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="partner@example.com"
              />
            </FormField>
            <p className="text-xs leading-relaxed text-white/38">
              Using Resend sandbox? Only your Resend account email receives messages
              until you verify a domain. You can always copy the invite link below.
            </p>
            <Button
              variant="secondary"
              onClick={() => void handleInviteMember()}
              disabled={isSyncing || !inviteEmail.trim()}
            >
              {isSyncing ? "Sending..." : "Send invite"}
            </Button>
          </div>
        )}

        {invites.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-medium text-white/70">
              Pending invites
            </p>
            <ul className="space-y-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-white/70">{invite.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {invite.token && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void handleCopyInviteLink(invite.token!, invite.email)
                        }
                      >
                        Copy link
                      </Button>
                    )}
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
