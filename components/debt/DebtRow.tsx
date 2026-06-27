"use client";

import { Badge, Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatCurrency } from "@/lib/finance/format";
import type { DebtTableRow } from "@/lib/finance/types";

type DebtRowProps = {
  row: DebtTableRow;
  onEdit: () => void;
  onDelete: () => void;
  onMakePayment: () => void;
};

export function DebtRow({
  row,
  onEdit,
  onDelete,
  onMakePayment,
}: DebtRowProps) {
  const isPaidOff = row.balance <= 0;

  return (
    <article className="bill-card-enter rounded-3xl border border-white/[0.04] bg-white/[0.015] p-5 transition-colors duration-200 hover:border-white/[0.07] sm:p-6">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto] items-center gap-4 xl:grid">
        <p className="truncate text-base font-medium text-white">{row.name}</p>
        <p className="text-base font-semibold tabular-nums text-rose-300/90">
          {formatCurrency(row.balance)}
        </p>
        <p className="text-sm tabular-nums text-white/60">{row.interestRate}%</p>
        <p className="text-sm tabular-nums text-white/60">
          {formatCurrency(row.minimumPayment)}
        </p>
        <p className="text-sm text-white/60">{row.dueDate}</p>
        <Badge variant="default">{row.accountTypeLabel}</Badge>
        <div className="min-w-0">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-400/80 transition-all duration-500"
              style={{ width: `${row.progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-white/35">{row.progressLabel}</p>
        </div>
        <DebtRowActions
          isPaidOff={isPaidOff}
          onEdit={onEdit}
          onDelete={onDelete}
          onMakePayment={onMakePayment}
        />
      </div>

      <div className="space-y-4 xl:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="truncate text-lg font-semibold tracking-tight text-white">
                {row.name}
              </h3>
              <Badge variant="default">{row.accountTypeLabel}</Badge>
            </div>
            <p className="mt-2 text-sm text-white/38">
              {row.interestRate}% APR · Due {row.dueDate}
            </p>
            <p className="mt-1 text-sm text-white/38">
              Min payment {formatCurrency(row.minimumPayment)}
            </p>
          </div>
          <p className="shrink-0 text-xl font-semibold tabular-nums text-rose-300/90">
            {formatCurrency(row.balance)}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 text-sm text-white/45">
            <span>Payoff progress</span>
            <span>{row.progressLabel}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-400/80 transition-all duration-500"
              style={{ width: `${row.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="border-t border-white/[0.04] pt-5">
          <DebtRowActions
            isPaidOff={isPaidOff}
            onEdit={onEdit}
            onDelete={onDelete}
            onMakePayment={onMakePayment}
          />
        </div>
      </div>
    </article>
  );
}

function DebtRowActions({
  isPaidOff,
  onEdit,
  onDelete,
  onMakePayment,
}: {
  isPaidOff: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMakePayment: () => void;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2 xl:justify-end")}>
      <Button
        type="button"
        size="sm"
        onClick={onMakePayment}
        disabled={isPaidOff}
      >
        Make payment
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-rose-400/90 hover:text-rose-300"
      >
        Delete
      </Button>
    </div>
  );
}
