"use client";

import { Badge, Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatCurrency } from "@/lib/finance/format";
import { getIncomeStatusVariant } from "@/lib/finance/income";
import type { IncomeTableRow } from "@/lib/finance/types";

type IncomeRowProps = {
  row: IncomeTableRow;
  onEdit: () => void;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onMarkReceived: () => void;
};

export function IncomeRow({
  row,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onMarkReceived,
}: IncomeRowProps) {
  return (
    <article className="bill-card-enter rounded-3xl border border-white/[0.04] bg-white/[0.015] p-5 transition-colors duration-200 hover:border-white/[0.07] sm:p-6">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_auto] items-center gap-3 lg:grid">
        <p className="truncate text-base font-medium text-white">{row.name}</p>
        <p className="text-base font-semibold tabular-nums text-emerald-400/90">
          {formatCurrency(row.amount)}
        </p>
        <p className="text-sm text-white/60">{row.frequencyLabel}</p>
        <p className="truncate text-sm text-white/60">{row.category}</p>
        <p className="truncate text-sm text-white/60">{row.depositAccountName}</p>
        <p className="text-sm text-white/60">{row.nextPayDate}</p>
        <p className="text-sm text-white/60">{row.lastPaid}</p>
        <Badge variant={getIncomeStatusVariant(row.isActive)}>
          {row.statusLabel}
        </Badge>
        <IncomeRowActions
          row={row}
          onEdit={onEdit}
          onDelete={onDelete}
          onPause={onPause}
          onResume={onResume}
          onMarkReceived={onMarkReceived}
        />
      </div>

      <div className="space-y-4 lg:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="truncate text-lg font-semibold tracking-tight text-white">
                {row.name}
              </h3>
              <Badge variant={getIncomeStatusVariant(row.isActive)}>
                {row.statusLabel}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-white/38">
              {row.frequencyLabel} · {row.category}
            </p>
            <p className="mt-1 text-sm text-white/38">
              Deposit: {row.depositAccountName}
            </p>
            <p className="mt-1 text-sm text-white/38">
              Next {row.nextPayDate} · Last paid {row.lastPaid}
            </p>
          </div>
          <p className="shrink-0 text-xl font-semibold tabular-nums text-emerald-400/90">
            {formatCurrency(row.amount)}
          </p>
        </div>

        <div className="border-t border-white/[0.04] pt-5">
          <IncomeRowActions
            row={row}
            compact
            onEdit={onEdit}
            onDelete={onDelete}
            onPause={onPause}
            onResume={onResume}
            onMarkReceived={onMarkReceived}
          />
        </div>
      </div>
    </article>
  );
}

function IncomeRowActions({
  row,
  compact = false,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onMarkReceived,
}: IncomeRowProps & { compact?: boolean }) {
  if (row.isFromIncomePlan) {
    return (
      <p className="text-sm text-white/45">
        Managed in Paycheck plan
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2",
        compact ? "flex-col sm:flex-row sm:flex-wrap" : "flex-wrap lg:justify-end",
      )}
    >
      <Button
        type="button"
        size="sm"
        className={compact ? "min-h-11 w-full sm:w-auto" : undefined}
        onClick={onMarkReceived}
        disabled={!row.canMarkReceived}
      >
        Mark received
      </Button>
      {row.isActive ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={compact ? "min-h-11 w-full sm:w-auto" : undefined}
          onClick={onPause}
        >
          Pause
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={compact ? "min-h-11 w-full sm:w-auto" : undefined}
          onClick={onResume}
        >
          Resume
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={compact ? "min-h-11 w-full sm:w-auto" : undefined}
        onClick={onEdit}
      >
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "text-rose-400/90 hover:text-rose-300",
          compact ? "min-h-11 w-full sm:w-auto" : undefined,
        )}
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}
