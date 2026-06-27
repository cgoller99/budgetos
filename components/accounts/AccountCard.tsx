import { Badge, Card, CardContent } from "@/components/ui";
import {
  formatAccountType,
  isLiabilityAccountType,
} from "@/lib/finance/accountTypes";
import { formatCurrency } from "@/lib/finance/format";
import type { Account } from "@/lib/finance/types";

type AccountCardProps = {
  account: Account;
};

export function AccountCard({ account }: AccountCardProps) {
  const isLiability = isLiabilityAccountType(account.type);

  return (
    <Card hover className="account-card-enter">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight text-white">
            {account.name}
          </h3>
          <p className="mt-2 truncate text-sm text-white/38">
            {account.institution}
          </p>
        </div>
        <Badge>{formatAccountType(account.type)}</Badge>
      </div>

      <CardContent className="mt-8 border-t border-white/[0.04] pt-6">
        <p
          className={`text-3xl font-semibold tracking-tight tabular-nums ${
            isLiability ? "text-rose-400/90" : "text-white"
          }`}
        >
          {isLiability ? "-" : ""}
          {formatCurrency(account.balance)}
        </p>
      </CardContent>
    </Card>
  );
}
