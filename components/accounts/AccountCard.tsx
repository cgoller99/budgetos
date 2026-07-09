import { Badge, Card, CardContent } from "@/components/ui";
import { AccountActionsMenu } from "@/components/accounts/AccountActionsMenu";
import {
  ACCOUNT_COLOR_OPTIONS,
  getAccountDisplayName,
} from "@/lib/finance/accountPreferences";
import {
  formatAccountType,
  isLiabilityAccountType,
} from "@/lib/finance/accountTypes";
import { formatCurrency } from "@/lib/finance/format";
import type { Account } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

type AccountCardProps = {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
};

function getAccountAccentClass(color?: string | null): string {
  const match = ACCOUNT_COLOR_OPTIONS.find((option) => option.value === color);
  return match?.className ?? "bg-[#0077ed]";
}

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const isLiability = isLiabilityAccountType(account.type);
  const displayName = getAccountDisplayName(account);

  return (
    <Card hover className="account-card-enter relative overflow-hidden">
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          getAccountAccentClass(account.color),
        )}
      />

      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 text-2xl" aria-hidden>
            {account.icon ?? "🏦"}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight text-white">
              {displayName}
            </h3>
            <p className="mt-1 truncate text-sm text-white/38">
              {account.institution}
              {account.lastFour ? ` · •••• ${account.lastFour}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{formatAccountType(account.type)}</Badge>
              {account.isPlaidLinked && <Badge>Plaid</Badge>}
              {account.isHidden && <Badge>Hidden</Badge>}
              {account.archivedAt && <Badge>Archived</Badge>}
            </div>
          </div>
        </div>
        <AccountActionsMenu onEdit={onEdit} onDelete={onDelete} />
      </div>

      <CardContent className="mt-8 border-t border-white/[0.04] pt-6 pl-2">
        <p
          className={`text-3xl font-semibold tracking-tight tabular-nums ${
            isLiability ? "text-rose-400/90" : "text-white"
          }`}
        >
          {isLiability ? "-" : ""}
          {formatCurrency(account.balance)}
        </p>
        {account.isPlaidLinked && account.lastSyncedAt && (
          <p className="mt-2 text-xs text-white/35">
            Synced {new Date(account.lastSyncedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
