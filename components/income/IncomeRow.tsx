"use client";

import { useEffect, useRef } from "react";
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
    <article className="min-w-0 rounded-[14px] border border-[var(--surface-border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 max-w-full truncate text-base font-semibold text-[var(--foreground)]">
              {row.name}
            </h3>
            <Badge variant={getIncomeStatusVariant(row.isActive)}>{row.statusLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {row.frequencyLabel}
            {row.category !== "—" ? ` · ${row.category}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-xl font-semibold tabular-nums text-[var(--success)]">
          {formatCurrency(row.amount)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-2">
        <Detail label="Next payday" value={row.nextPayDate} />
        <Detail label="Last received" value={row.lastPaid} />
        <Detail label="Deposits to" value={row.depositAccountName} />
      </dl>

      <div className="mt-4 flex flex-wrap items-start justify-end gap-2 border-t border-[var(--surface-border)] pt-3">
        <IncomeRowActions
          row={row}
          onEdit={onEdit}
          onDelete={onDelete}
          onPause={onPause}
          onResume={onResume}
          onMarkReceived={onMarkReceived}
        />
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function IncomeRowActions({
  row,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onMarkReceived,
}: IncomeRowProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!menuRef.current?.open) return;
      if (event.target instanceof Node && menuRef.current.contains(event.target)) return;
      menuRef.current.open = false;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (row.isFromIncomePlan) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">Managed in Paycheck plan</p>
    );
  }

  function closeMenu() {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="min-h-11 shrink-0"
        onClick={onMarkReceived}
        disabled={!row.canMarkReceived}
      >
        Mark received
      </Button>
      <details ref={menuRef} className="min-w-0">
        <summary
          className={cn(
            "focus-ring inline-flex min-h-11 cursor-pointer list-none items-center rounded-[var(--radius-button)] border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3.5 text-sm font-medium text-[var(--text-secondary)]",
            "[&::-webkit-details-marker]:hidden",
          )}
        >
          More
        </summary>
        <div className="mt-1 w-40 max-w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-1">
          <MenuButton
            label={row.isActive ? "Pause" : "Resume"}
            onClick={() => {
              closeMenu();
              if (row.isActive) onPause();
              else onResume();
            }}
          />
          <MenuButton
            label="Edit"
            onClick={() => {
              closeMenu();
              onEdit();
            }}
          />
          <MenuButton
            label="Delete"
            danger
            onClick={() => {
              closeMenu();
              onDelete();
            }}
          />
        </div>
      </details>
    </>
  );
}

function MenuButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium",
        danger
          ? "text-[var(--danger)] hover:bg-[var(--danger-muted)]"
          : "text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
