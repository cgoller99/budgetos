"use client";

import { useMemo, useState } from "react";
import {
  IosHeroMetric,
  IosLink,
  IosList,
  IosListRow,
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
import { ProgressBar } from "@/components/ui";

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
          label="Total debt"
          value={formatCurrency(summary.totalDebt)}
          hint={
            summary.activeDebtCount > 0
              ? `${summary.activeDebtCount} active · payoff ${summary.estimatedDebtFreeDate}`
              : "You’re debt free"
          }
          tone={summary.totalDebt === 0 ? "positive" : "default"}
        />
        <IosTextButton
          onClick={() => {
            void triggerHaptic("light");
            setCreateOpen(true);
          }}
        >
          Add
        </IosTextButton>
      </div>

      {summary.activeDebtCount > 0 ? (
        <>
          <IosSection title="This month">
            <IosList>
              <IosListRow
                title="Minimum payments"
                subtitle="Required across debts"
                trailing={formatCurrency(summary.totalMinimumPayments)}
              />
              {summary.nextPayment ? (
                <IosListRow
                  title={summary.nextPayment.name}
                  subtitle={`Next · ${summary.nextPayment.dueDate}`}
                  trailing={formatCurrency(summary.nextPayment.amount)}
                />
              ) : null}
            </IosList>
          </IosSection>

          <IosSection title="Payoff progress">
            <div className="rounded-[12px] bg-[var(--surface-subtle)] px-3.5 py-3.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-[var(--foreground)]">
                  Debt-free progress
                </p>
                <p className="text-[13px] tabular-nums text-[var(--text-muted)]">
                  {Math.round(summary.debtFreeProgress)}%
                </p>
              </div>
              <ProgressBar value={summary.debtFreeProgress} />
              <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                Strategy: {strategy === "avalanche" ? "Avalanche" : "Snowball"} · Est.{" "}
                {summary.estimatedDebtFreeDate}
              </p>
              <div className="mt-2 flex justify-end">
                <IosTextButton
                  className="px-0"
                  onClick={() => {
                    void triggerHaptic("selection");
                    setShowDetails((current) => !current);
                  }}
                >
                  {showDetails ? "Hide Details" : "View Details"}
                </IosTextButton>
              </div>
            </div>
          </IosSection>

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
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span>{formatCurrency(row.balance)}</span>
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
        <IosSection>
          <IosList>
            <IosListRow
              title="Add a debt"
              subtitle="Track balances, APR, and payoff date"
              onClick={() => setCreateOpen(true)}
              trailing={<span className="text-[var(--accent-light)]">›</span>}
            />
          </IosList>
          <div className="mt-3 px-1">
            <IosLink href="/accounts">Import from Accounts</IosLink>
          </div>
        </IosSection>
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
