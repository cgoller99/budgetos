"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkline } from "@/components/charts/Sparkline";
import { CHART_COLORS } from "@/components/charts/constants";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";
import { isDisplayedInflow } from "@/lib/transactions/refunds";
import type { Account, BankConnection, Transaction } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/ui/bodyScrollLock";

type IosAccountDetailSheetProps = {
  account: Account | null;
  connection: BankConnection | null;
  activity: number[];
  recent: Transaction[];
  onClose: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
};

function syncLabel(account: Account, connection: BankConnection | null): string {
  if (connection?.status === "error") return "Needs reconnect";
  const syncedAt = account.lastSyncedAt ?? connection?.lastSyncedAt;
  if (!account.isPlaidLinked) return "Manual account";
  if (!syncedAt) return "Waiting for first sync";
  const date = new Date(syncedAt);
  if (Number.isNaN(date.getTime())) return "Waiting for first sync";
  return `Synced ${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function IosAccountDetailSheet({
  account,
  connection,
  activity,
  recent,
  onClose,
  onEdit,
  onRemove,
}: IosAccountDetailSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [presented, setPresented] = useState<Account | null>(account);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOrigin = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (account) {
      setPresented(account);
      setVisible(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setAnimating(true));
      });
      lockBodyScroll();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onCloseRef.current();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.cancelAnimationFrame(frame);
        unlockBodyScroll();
        window.removeEventListener("keydown", onKeyDown);
      };
    }

    setAnimating(false);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => {
      setVisible(false);
      setPresented(null);
    }, reduceMotion ? 0 : 220);
    return () => window.clearTimeout(timeout);
  }, [account]);

  function setDrag(next: number) {
    dragOffsetRef.current = next;
    setDragOffset(next);
  }

  function endDrag() {
    const shouldClose = dragOffsetRef.current > 96;
    dragOrigin.current = null;
    setDrag(0);
    if (shouldClose) onCloseRef.current();
  }

  const shown = account ?? presented;
  if (!visible || !shown || typeof document === "undefined") return null;

  const mask = shown.lastFour ? `•••• ${shown.lastFour.slice(-4)}` : null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close account"
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200",
          animating ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onCloseRef.current()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account details"
        className={cn(
          "native-sheet native-keyboard-avoid absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[22px] border border-white/[0.08] border-b-0 bg-[#0b0f14] pt-2 transition-transform duration-200 ease-out",
          animating ? "translate-y-0" : "translate-y-full",
        )}
        style={
          dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)`, transition: "none" }
            : undefined
        }
      >
        <div
          className="mx-auto mb-2 flex h-7 w-full shrink-0 touch-none items-center justify-center px-4"
          data-sheet-handle="true"
          onPointerDown={(event) => {
            dragOrigin.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragOrigin.current == null) return;
            setDrag(Math.max(0, event.clientY - dragOrigin.current));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <p className="text-center text-[13px] font-medium text-[var(--text-muted)]">
            {shown.nickname || shown.name}
          </p>
          <p className="mt-1 text-center text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
            {formatCurrency(shown.balance)}
          </p>
          <p className="mt-2 text-center text-[13px] text-[var(--text-secondary)]">
            {formatMonthlyChange(shown.monthlyChange)}
          </p>
          <p
            className={cn(
              "mt-1 text-center text-[13px] font-medium",
              connection?.status === "error"
                ? "text-[var(--warning)]"
                : "text-[var(--text-muted)]",
            )}
          >
            {syncLabel(shown, connection)}
          </p>

          <div className="mt-4 rounded-[16px] bg-white/[0.04] px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[var(--text-muted)]">6-month activity</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-subtle)]">
                  {[shown.institution, mask].filter(Boolean).join(" · ") || shown.type}
                </p>
              </div>
              <Sparkline values={activity} color={CHART_COLORS.primary} width={112} height={40} />
            </div>
          </div>

          {recent.length > 0 ? (
            <ul className="mt-4 overflow-hidden rounded-[16px] bg-white/[0.04]">
              {recent.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3.5 py-3 last:border-b-0"
                >
                  <p className="truncate text-[14px] text-[var(--foreground)]">
                    {transaction.notes || transaction.category}
                  </p>
                  <p
                    className={cn(
                      "shrink-0 text-[14px] font-medium tabular-nums",
                      isDisplayedInflow(transaction)
                        ? "text-[var(--success)]"
                        : transaction.type === "expense"
                          ? "text-[var(--danger)]"
                          : "text-[var(--text-secondary)]",
                    )}
                  >
                    {isDisplayedInflow(transaction) ? "+" : transaction.type === "expense" ? "−" : ""}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="h-3" />
        </div>

        {onEdit || onRemove ? (
          <div
            className="shrink-0 border-t border-white/[0.06] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
            data-account-detail-footer="true"
          >
            <div className="flex gap-2">
              {onEdit ? (
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white active:opacity-90"
                  onClick={() => {
                    void triggerHaptic("light");
                    onEdit();
                  }}
                >
                  Edit
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--danger)] active:opacity-90"
                  onClick={() => {
                    void triggerHaptic("light");
                    onRemove();
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="pb-[calc(1rem+env(safe-area-inset-bottom))]" />
        )}
      </div>
    </div>,
    document.body,
  );
}
