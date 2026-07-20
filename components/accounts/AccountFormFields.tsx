"use client";

import { FormField, Input, Select } from "@/components/ui";
import { PreferenceToggle } from "@/components/ui/PreferenceToggle";
import { cn } from "@/components/ui/cn";
import { formatAccountType } from "@/lib/finance/accountTypes";
import {
  ACCOUNT_COLOR_OPTIONS,
  ACCOUNT_ICON_OPTIONS,
} from "@/lib/finance/accountPreferences";
import { formatCurrency } from "@/lib/finance/format";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/finance/accountTypes";
import type { Account, AccountType, EditAccountInput } from "@/lib/finance/types";

export type AccountFormState = {
  name: string;
  institution: string;
  type: AccountType;
  balance: string;
  startingBalance: string;
  nickname: string;
  icon: string;
  color: string;
  includeInNetWorth: boolean;
  includeInSafeToSpend: boolean;
  isHidden: boolean;
  isArchived: boolean;
};

export const initialAccountFormState: AccountFormState = {
  name: "",
  institution: "",
  type: "checking",
  balance: "",
  startingBalance: "",
  nickname: "",
  icon: "🏦",
  color: "blue",
  includeInNetWorth: true,
  includeInSafeToSpend: true,
  isHidden: false,
  isArchived: false,
};

export function accountToFormState(account: Account): AccountFormState {
  return {
    name: account.name,
    institution: account.institution,
    type: account.type,
    balance: String(account.balance),
    startingBalance:
      account.startingBalance === null || account.startingBalance === undefined
        ? ""
        : String(account.startingBalance),
    nickname: account.nickname ?? "",
    icon: account.icon ?? "🏦",
    color: account.color ?? "blue",
    includeInNetWorth: account.includeInNetWorth !== false,
    includeInSafeToSpend: account.includeInSafeToSpend !== false,
    isHidden: account.isHidden === true,
    isArchived: Boolean(account.archivedAt),
  };
}

export function parseAccountForm(
  form: AccountFormState,
  isPlaidLinked: boolean,
): EditAccountInput | null {
  const balance = Number.parseFloat(form.balance);
  const startingBalance = form.startingBalance.trim()
    ? Number.parseFloat(form.startingBalance)
    : null;

  if (isPlaidLinked) {
    return {
      nickname: form.nickname.trim() || null,
      icon: form.icon,
      color: form.color,
      includeInNetWorth: form.includeInNetWorth,
      includeInSafeToSpend: form.includeInSafeToSpend,
      isHidden: form.isHidden,
      isArchived: form.isArchived,
    };
  }

  if (
    !form.name.trim() ||
    !form.institution.trim() ||
    Number.isNaN(balance) ||
    (form.startingBalance.trim() && Number.isNaN(startingBalance))
  ) {
    return null;
  }

  return {
    name: form.name,
    institution: form.institution,
    type: form.type,
    balance,
    startingBalance,
    nickname: form.nickname.trim() || null,
    icon: form.icon,
    color: form.color,
    includeInNetWorth: form.includeInNetWorth,
    includeInSafeToSpend: form.includeInSafeToSpend,
    isHidden: form.isHidden,
    isArchived: form.isArchived,
  };
}

type AccountFormFieldsProps = {
  account: Account;
  form: AccountFormState;
  onChange: (form: AccountFormState) => void;
};

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <FormField label={label} hint={hint}>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/70">
        {value}
      </div>
    </FormField>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>
      </div>
      <PreferenceToggle
        checked={checked}
        onChange={onChange}
        label={label}
      />
    </div>
  );
}

export function AccountFormFields({
  account,
  form,
  onChange,
}: AccountFormFieldsProps) {
  const isPlaidLinked = Boolean(account.isPlaidLinked);

  function updateField<K extends keyof AccountFormState>(
    key: K,
    value: AccountFormState[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-5">
      {isPlaidLinked ? (
        <>
          <ReadOnlyField
            label="Account name"
            value={account.name}
            hint="Managed by your bank via Plaid"
          />
          <ReadOnlyField
            label="Institution"
            value={account.institution}
            hint="Plaid-managed"
          />
          <ReadOnlyField
            label="Account type"
            value={formatAccountType(account.type)}
            hint="Plaid-managed"
          />
          <ReadOnlyField
            label="Current balance"
            value={formatCurrency(account.balance)}
            hint="Updated automatically when your bank syncs"
          />
          {account.lastFour && (
            <ReadOnlyField label="Account number" value={`•••• ${account.lastFour}`} />
          )}

          <FormField label="Nickname" hint="Optional display name for this account">
            <Input
              type="text"
              value={form.nickname}
              onChange={(event) => updateField("nickname", event.target.value)}
              placeholder={account.name}
            />
          </FormField>
        </>
      ) : (
        <>
          <FormField label="Account name">
            <Input
              type="text"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
            />
          </FormField>

          <FormField label="Institution">
            <Input
              type="text"
              value={form.institution}
              onChange={(event) => updateField("institution", event.target.value)}
              required
            />
          </FormField>

          <FormField label="Account type">
            <Select
              value={form.type}
              onChange={(event) =>
                updateField("type", event.target.value as AccountType)
              }
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Starting balance">
            <Input
              type="number"
              step="0.01"
              value={form.startingBalance}
              onChange={(event) =>
                updateField("startingBalance", event.target.value)
              }
              placeholder="Optional"
            />
          </FormField>

          <FormField label="Current balance">
            <Input
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(event) => updateField("balance", event.target.value)}
              required
            />
          </FormField>

          <FormField label="Nickname" hint="Optional display name">
            <Input
              type="text"
              value={form.nickname}
              onChange={(event) => updateField("nickname", event.target.value)}
              placeholder={form.name || "Primary Checking"}
            />
          </FormField>
        </>
      )}

      <FormField label="Icon">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {ACCOUNT_ICON_OPTIONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => updateField("icon", icon)}
              className={cn(
                "focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-2xl border text-xl transition-colors",
                form.icon === icon
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/15"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]",
              )}
              aria-label={`Select ${icon}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Color">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ACCOUNT_COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateField("color", option.value)}
              className={cn(
                "focus-ring flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-medium text-white/80",
                form.color === option.value
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                  : "border-white/[0.06] bg-white/[0.02]",
              )}
            >
              <span className={cn("size-3 rounded-full", option.className)} />
              {option.label}
            </button>
          ))}
        </div>
      </FormField>

      <div className="space-y-3">
        <PreferenceRow
          label="Include in Net Worth"
          description="Count this account in your net worth calculations."
          checked={form.includeInNetWorth}
          onChange={(checked) => updateField("includeInNetWorth", checked)}
        />
        <PreferenceRow
          label="Include in Safe to Spend"
          description="Use this account when calculating available cash for spending."
          checked={form.includeInSafeToSpend}
          onChange={(checked) => updateField("includeInSafeToSpend", checked)}
        />
        <PreferenceRow
          label="Hide account"
          description="Hide this account from your main accounts list."
          checked={form.isHidden}
          onChange={(checked) => updateField("isHidden", checked)}
        />
        <PreferenceRow
          label="Archive account"
          description="Archive inactive accounts without deleting their history."
          checked={form.isArchived}
          onChange={(checked) => updateField("isArchived", checked)}
        />
      </div>
    </div>
  );
}
