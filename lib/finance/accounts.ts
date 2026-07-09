import type { Account, AccountType, EditAccountInput } from "@/lib/finance/types";

export function buildUpdatedAccount(
  existing: Account,
  input: EditAccountInput,
): Account {
  const next: Account = {
    ...existing,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.institution !== undefined
      ? { institution: input.institution.trim() }
      : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.balance !== undefined ? { balance: input.balance } : {}),
    ...(input.startingBalance !== undefined
      ? { startingBalance: input.startingBalance }
      : {}),
    ...(input.nickname !== undefined
      ? { nickname: input.nickname?.trim() || null }
      : {}),
    ...(input.icon !== undefined ? { icon: input.icon || null } : {}),
    ...(input.color !== undefined ? { color: input.color || null } : {}),
    ...(input.includeInNetWorth !== undefined
      ? { includeInNetWorth: input.includeInNetWorth }
      : {}),
    ...(input.includeInSafeToSpend !== undefined
      ? { includeInSafeToSpend: input.includeInSafeToSpend }
      : {}),
    ...(input.isHidden !== undefined ? { isHidden: input.isHidden } : {}),
    ...(input.isArchived !== undefined
      ? {
          archivedAt: input.isArchived ? new Date().toISOString() : null,
        }
      : {}),
  };

  return next;
}

export function applyPlaidAccountEditRestrictions(
  existing: Account,
  input: EditAccountInput,
): EditAccountInput {
  if (!existing.isPlaidLinked) {
    return input;
  }

  return {
    nickname: input.nickname,
    icon: input.icon,
    color: input.color,
    includeInNetWorth: input.includeInNetWorth,
    includeInSafeToSpend: input.includeInSafeToSpend,
    isHidden: input.isHidden,
    isArchived: input.isArchived,
  };
}

export function getEditableAccountType(type: AccountType): AccountType {
  return type;
}
