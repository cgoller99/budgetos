"use client";

import { useMemo, useState } from "react";
import {
  IosAvatar,
  IosCard,
  IosHeroMetric,
  IosIconButton,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
} from "@/components/native/ios/IosPrimitives";
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
import { AddDebtModal } from "@/components/debt/AddDebtModal";
import { DeleteDebtModal } from "@/components/debt/DeleteDebtModal";
import { EditDebtModal } from "@/components/debt/EditDebtModal";
import { MakePaymentModal } from "@/components/debt/MakePaymentModal";
import { DebtStrategyPanel } from "@/components/debt/DebtStrategyPanel";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  getDebtsDashboardSummary,
  getDebtTableRows,
} from "@/lib/finance/debts";
import type { Debt, DebtStrategy } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";

export function IosDebtScreen() {
  const finance = useFinance();
  const { isLoading } = finance;
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [showDetails, setShowDetails] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDebtId, setEditDebtId] = useState<string | null>(null);
  const [deleteDebtId, setDeleteDebtId] = useState<string | null>(null);
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);

  const summary = useMemo(() => getDebtsDashboardSummary(finance), [finance]);
  const rows = useMemo(() => getDebtTableRows(finance), [finance]);

  if (isLoading) {
    return <IosSkeletonScreen rows={5} />;
  }

  const editDebt =
    editDebtId !== null
      ? (finance.debts.find((debt) => debt.id === editDebtId) ?? null)
      : null;
  const deleteDebt =
    deleteDebtId !== null
      ? (finance.debts.find((debt) => debt.id === deleteDebtId) ?? null)
      : null;
  const paymentDebt =
    paymentDebtId !== null
      ? (finance.debts.find((debt) => debt.id === paymentDebtId) ?? null)
      : null;

  return (
    <IosScreen>
      <div className="flex items-start justify-between gap-3">
        <IosHeroMetric
          label="Total Debt"
          value={formatCurrency(summary.totalDebt)}
          tone={summary.totalDebt === 0 ? "positive" : "default"}
        />
        <IosIconButton
          label="Add debt"
          onClick={() => {
            void triggerHaptic("light");
            setCreateOpen(true);
          }}
        >
          <span className="text-xl leading-none">+</span>
        </IosIconButton>
      </div>

      {summary.activeDebtCount > 0 ? (
        <>
          <p className="px-0.5 text-[13px] text-[var(--text-secondary)]">
            {formatCurrency(summary.totalMinimumPayments)} / month
            {" · "}
            <span
              className={
                summary.estimatedDebtFreeDate === "Add payment plan"
                  ? "font-semibold text-[var(--accent-light)]"
                  : undefined
              }
            >
              {summary.estimatedDebtFreeDate === "Add payment plan"
                ? "Add payment plan"
                : `Debt-free ${summary.estimatedDebtFreeDate}`}
            </span>
            {" · "}
            {Math.round(summary.debtFreeProgress)}% paid off
          </p>

          <IosSection title="Debts">
            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="w-full rounded-[16px] bg-[var(--surface)] p-3.5 text-left active:bg-white/[0.04]"
                  onClick={() => {
                    void triggerHaptic("selection");
                    setSelectedDebtId(row.id);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <IosAvatar
                      fallback={row.name.slice(0, 1).toUpperCase()}
                      tone="danger"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {row.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        {row.interestRate}% APR · {row.accountTypeLabel}
                      </p>
                    </div>
                    <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                      {formatCurrency(row.balance)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <IosProgressBar value={row.progressPercent} className="flex-1" />
                    <span className="text-[12px] font-medium tabular-nums text-[var(--text-muted)]">
                      {row.progressLabel}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </IosSection>

          <button
            type="button"
            className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-[16px] bg-[var(--surface)] px-3.5 py-3 text-left active:bg-white/[0.04]"
            onClick={() => {
              void triggerHaptic("selection");
              setShowDetails((current) => !current);
            }}
          >
            <span>
              <span className="block text-[15px] font-semibold text-[var(--foreground)]">
                Payoff strategy
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                {summary.estimatedDebtFreeDate === "Add payment plan"
                  ? "Add a monthly payment to estimate your debt-free date"
                  : `You’ll be debt free ${summary.estimatedDebtFreeDate}`}
              </span>
            </span>
            <span className="text-[13px] font-semibold text-[var(--accent-light)]">
              {showDetails ? "Hide" : "View"}
            </span>
          </button>
          {showDetails ? (
            <IosSection title="Payoff strategy">
              <DebtStrategyPanel
                data={finance}
                strategy={strategy}
                onStrategyChange={setStrategy}
              />
            </IosSection>
          ) : null}
        </>
      ) : (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            No debts added
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Track balances, APR, and a realistic payoff date.
          </p>
          <button
            type="button"
            className="mt-4 min-h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white"
            onClick={() => {
              void triggerHaptic("light");
              setCreateOpen(true);
            }}
          >
            Add debt
          </button>
        </IosCard>
      )}

      <IosBottomSheet
        open={selectedDebtId !== null}
        title={rows.find((row) => row.id === selectedDebtId)?.name}
        onClose={() => setSelectedDebtId(null)}
      >
        {(() => {
          const row = rows.find((item) => item.id === selectedDebtId);
          if (!row) return null;
          return (
            <div>
              <p className="text-center text-[34px] font-semibold leading-none tabular-nums text-[var(--foreground)]">
                {formatCurrency(row.balance)}
              </p>
              <p className="mt-2 text-center text-[13px] text-[var(--text-muted)]">
                {row.progressLabel} · {row.interestRate}% APR
              </p>
              <IosProgressBar value={row.progressPercent} className="mt-4" />
              <div className="mt-4 rounded-[16px] bg-white/[0.04] px-3.5 py-3 text-[14px] text-[var(--text-secondary)]">
                <p>Minimum {formatCurrency(row.minimumPayment)}</p>
                <p className="mt-1">Due {row.dueDate}</p>
                <p className="mt-1">{row.accountTypeLabel}</p>
                <p className="mt-1">Debt-free target {summary.estimatedDebtFreeDate}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white"
                  onClick={() => {
                    void triggerHaptic("light");
                    setPaymentDebtId(row.id);
                    setSelectedDebtId(null);
                  }}
                >
                  Record payment
                </button>
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--foreground)]"
                  onClick={() => {
                    void triggerHaptic("light");
                    setEditDebtId(row.id);
                    setSelectedDebtId(null);
                  }}
                >
                  Edit
                </button>
              </div>
              <button
                type="button"
                className="mt-2 min-h-12 w-full rounded-[14px] text-[16px] font-semibold text-[var(--danger)]"
                onClick={() => {
                  void triggerHaptic("light");
                  setDeleteDebtId(row.id);
                  setSelectedDebtId(null);
                }}
              >
                Remove
              </button>
            </div>
          );
        })()}
      </IosBottomSheet>
      <AddDebtModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditDebtModal debt={editDebt as Debt | null} onClose={() => setEditDebtId(null)} />
      <DeleteDebtModal
        debt={deleteDebt as Debt | null}
        onClose={() => setDeleteDebtId(null)}
      />
      <MakePaymentModal
        debt={paymentDebt as Debt | null}
        onClose={() => setPaymentDebtId(null)}
      />
    </IosScreen>
  );
}
