"use client";

import { useMemo, useState } from "react";
import {
  IosAvatar,
  IosCard,
  IosHeroMetric,
  IosIconButton,
  IosList,
  IosListRow,
  IosProgressBar,
  IosRing,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
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
          <div className="grid grid-cols-2 gap-3">
            <IosCard padding="md">
              <p className="text-[12px] font-medium text-[var(--text-muted)]">
                Monthly Payment
              </p>
              <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(summary.totalMinimumPayments)}
              </p>
            </IosCard>
            <IosCard padding="md">
              <p className="text-[12px] font-medium text-[var(--text-muted)]">
                Debt Free Date
              </p>
              <p className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
                {summary.estimatedDebtFreeDate}
              </p>
            </IosCard>
          </div>

          <IosCard padding="md">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[14px] font-semibold text-[var(--foreground)]">
                Payoff Progress
              </p>
              <p className="text-[13px] tabular-nums text-[var(--text-muted)]">
                {Math.round(summary.debtFreeProgress)}%
              </p>
            </div>
            <IosProgressBar value={summary.debtFreeProgress} />
          </IosCard>

          <IosCard padding="md" className="flex items-center gap-4">
            <IosRing
              value={summary.debtFreeProgress}
              size={72}
              stroke={7}
              label={`${Math.round(summary.debtFreeProgress)}%`}
            />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                {Math.round(summary.debtFreeProgress)}% of total debt paid off
              </p>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                You’ll be debt free {summary.estimatedDebtFreeDate}
              </p>
              <IosTextButton
                className="mt-1 px-0"
                onClick={() => {
                  void triggerHaptic("selection");
                  setShowDetails((current) => !current);
                }}
              >
                {showDetails ? "Hide Details" : "View Details"}
              </IosTextButton>
            </div>
          </IosCard>

          {showDetails ? (
            <IosSection title="Payoff strategy">
              <DebtStrategyPanel
                data={finance}
                strategy={strategy}
                onStrategyChange={setStrategy}
              />
            </IosSection>
          ) : null}

          <IosSection title="Debts">
            <IosList>
              {rows.map((row) => (
                <IosListRow
                  key={row.id}
                  title={row.name}
                  subtitle={`${row.interestRate}% APR · ${row.accountTypeLabel}`}
                  leading={
                    <IosAvatar
                      fallback={row.name.slice(0, 1).toUpperCase()}
                      tone="danger"
                    />
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span>{formatCurrency(row.balance)}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {row.progressLabel}
                      </span>
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-[var(--accent-light)]"
                        onClick={() => {
                          void triggerHaptic("light");
                          setPaymentDebtId(row.id);
                        }}
                      >
                        Pay
                      </button>
                    </div>
                  }
                  onClick={() => setEditDebtId(row.id)}
                />
              ))}
            </IosList>
          </IosSection>
        </>
      ) : (
        <IosList>
          <IosListRow
            title="Add a debt"
            subtitle="Track balances, APR, and payoff date"
            leading={<IosAvatar fallback="+" tone="accent" />}
            onClick={() => setCreateOpen(true)}
            trailing={<span className="text-[var(--accent-light)]">›</span>}
          />
        </IosList>
      )}

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
