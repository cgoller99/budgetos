"use client";

import { useState } from "react";
import Link from "next/link";
import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
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
import { isStripeClientEnabled } from "@/lib/stripe/clientConfig";
import { getHouseholdInviteUrl } from "@/lib/household/inviteUrls";
import type { HouseholdMember } from "@/lib/finance/types";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function formatInviteDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isInviteExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function getMemberLabel(member: HouseholdMember): string {
  return member.email ?? member.userId.slice(0, 8);
}

export function HouseholdSection() {
  const { user } = useAuth();
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
    leaveHousehold,
    removeMember,
    transferOwnership,
    revokeInvite,
  } = useHousehold();
  const { hasProAccess, isFounder } = useSubscription();
  const { refreshFinance } = useFinance();
  const { showToast } = useToast();
  const [householdName, setHouseholdName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const otherMembers = members.filter(
    (member) => member.userId !== user?.id && member.role !== "owner",
  );

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

  async function handleLeaveHousehold() {
    const confirmed = window.confirm(
      "Leave this household? You will lose access to shared finances.",
    );

    if (!confirmed) {
      return;
    }

    setPendingAction("leave");

    try {
      await leaveHousehold();
      await refreshFinance();
      showToast({
        title: "Left household",
        subtitle: "You no longer share this household's data.",
      });
    } catch {
      // Error surfaced in context
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveMember(memberUserId: string, label: string) {
    const confirmed = window.confirm(`Remove ${label} from the household?`);

    if (!confirmed) {
      return;
    }

    setPendingAction(`remove-${memberUserId}`);

    try {
      await removeMember(memberUserId);
      await refreshFinance();
      showToast({
        title: "Member removed",
        subtitle: `${label} no longer has access.`,
      });
    } catch {
      // Error surfaced in context
    } finally {
      setPendingAction(null);
    }
  }

  async function handleTransferOwnership(memberUserId: string, label: string) {
    const confirmed = window.confirm(
      `Transfer ownership to ${label}? You will become a member.`,
    );

    if (!confirmed) {
      return;
    }

    setPendingAction(`transfer-${memberUserId}`);

    try {
      await transferOwnership(memberUserId);
      showToast({
        title: "Ownership transferred",
        subtitle: `${label} is now the household owner.`,
      });
    } catch {
      // Error surfaced in context
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRevokeInvite(inviteId: string, email: string) {
    const confirmed = window.confirm(`Revoke the invite for ${email}?`);

    if (!confirmed) {
      return;
    }

    setPendingAction(`revoke-${inviteId}`);

    try {
      await revokeInvite(inviteId);
      showToast({
        title: "Invite revoked",
        subtitle: `The invite for ${email} is no longer valid.`,
      });
    } catch {
      // Error surfaced in context
    } finally {
      setPendingAction(null);
    }
  }

  if (isLoading) {
    return (
      <Card padding="lg">
        <CardHeader
          title="Shared household"
          action={
            <InfoTooltip label="Share the same finance workspace with a partner or household member." />
          }
        />
        <CardContent>
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        </CardContent>
      </Card>
    );
  }

  if (isStripeClientEnabled() && !isFounder && !hasProAccess) {
    return (
      <Card padding="lg">
        <CardHeader
          title="Shared household"
          action={<Badge variant="accent">Pro</Badge>}
        />
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-white/55">
            Household collaboration is included with Buxme Pro and Pro+. Upgrade
            your plan to create a shared workspace and invite members.
          </p>
          <Link href="/settings#billing">
            <Button size="md">Upgrade in billing settings</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!household) {
    return (
      <Card padding="lg">
        <CardHeader
          title="Shared household"
          action={
            <InfoTooltip label="Share the same finance workspace with a partner or household member." />
          }
        />
        <CardContent className="space-y-4">
          {incomingInvites.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
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
                      Sent {formatInviteDate(invite.createdAt)} · Expires{" "}
                      {formatInviteDate(invite.expiresAt)}
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
    <Card padding="lg" id="household">
      <CardHeader
        title="Shared household"
        action={
          <div className="flex items-center gap-2">
            <InfoTooltip label="Share the same finance workspace with a partner or household member." />
            {role ? (
              <Badge variant={role === "owner" ? "accent" : "default"}>
                {role === "owner" ? "Owner" : "Member"}
              </Badge>
            ) : null}
          </div>
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
              {members.map((member) => {
                const label = getMemberLabel(member);
                const isSelf = member.userId === user?.id;
                const canRemove =
                  role === "owner" && !isSelf && member.role !== "owner";
                const canTransfer =
                  role === "owner" && !isSelf && member.role !== "owner";

                return (
                  <li
                    key={`${member.householdId}-${member.userId}`}
                    className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-white/70">
                        {label}
                        {isSelf ? " (you)" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canTransfer && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSyncing || pendingAction !== null}
                          onClick={() =>
                            void handleTransferOwnership(member.userId, label)
                          }
                        >
                          {pendingAction === `transfer-${member.userId}`
                            ? "Transferring..."
                            : "Make owner"}
                        </Button>
                      )}
                      {canRemove && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSyncing || pendingAction !== null}
                          onClick={() =>
                            void handleRemoveMember(member.userId, label)
                          }
                        >
                          {pendingAction === `remove-${member.userId}`
                            ? "Removing..."
                            : "Remove"}
                        </Button>
                      )}
                      <Badge variant={member.role === "owner" ? "accent" : "default"}>
                        {member.role === "owner" ? "Owner" : "Member"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
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
              {invites.map((invite) => {
                const expired = isInviteExpired(invite.expiresAt);

                return (
                  <li
                    key={invite.id}
                    className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-white/70">{invite.email}</span>
                      <p className="mt-1 text-xs text-white/38">
                        Sent {formatInviteDate(invite.createdAt)} · Expires{" "}
                        {formatInviteDate(invite.expiresAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                      {role === "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSyncing || pendingAction !== null}
                          onClick={() =>
                            void handleRevokeInvite(invite.id, invite.email)
                          }
                        >
                          {pendingAction === `revoke-${invite.id}`
                            ? "Revoking..."
                            : "Revoke"}
                        </Button>
                      )}
                      <Badge variant={expired ? "danger" : "warning"}>
                        {expired ? "Expired" : "Pending"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {role === "member" && (
          <div className="border-t border-white/[0.06] pt-4">
            <Button
              variant="secondary"
              onClick={() => void handleLeaveHousehold()}
              disabled={isSyncing || pendingAction !== null}
            >
              {pendingAction === "leave" ? "Leaving..." : "Leave household"}
            </Button>
          </div>
        )}

        {role === "owner" && otherMembers.length > 0 && (
          <p className="text-xs text-white/32">
            Transfer ownership before leaving the household.
          </p>
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
