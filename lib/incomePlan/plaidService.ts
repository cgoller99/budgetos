import type {
  DirectDepositMatch,
  IncomePlanDirectDepositHook,
  IncomePlanPlaidService,
} from "@/lib/incomePlan/plaidTypes";
import type { FinanceData } from "@/lib/finance/types";
import { detectPayrollCandidates } from "@/lib/plaid/incomeDetectionService";
import type { PlaidMappedTransaction } from "@/lib/plaid/types";

function toPlaidMappedTransactions(data: FinanceData): PlaidMappedTransaction[] {
  return data.transactions
    .filter((transaction) => Boolean(transaction.externalTransactionId))
    .map((transaction) => {
      const account = data.accounts.find((item) => item.id === transaction.accountId);

      return {
        externalTransactionId: transaction.externalTransactionId!,
        externalAccountId: account?.externalAccountId ?? transaction.accountId,
        amount: transaction.amount,
        type: transaction.type === "transfer" ? "expense" : transaction.type,
        category: transaction.category,
        date: transaction.date,
        notes: transaction.notes,
        name: transaction.notes,
      };
    });
}

export class IncomePlanPlaidServiceImpl implements IncomePlanPlaidService {
  constructor(private readonly getData: () => FinanceData | null) {}

  async matchDirectDeposit(
    amount: number,
    postedDate: string,
  ): Promise<DirectDepositMatch | null> {
    const data = this.getData();
    const plan = data?.incomePlan;

    if (!data || !plan) {
      return null;
    }

    const depositAccount = data.accounts.find(
      (account) => account.id === plan.depositAccountId,
    );
    const candidates = detectPayrollCandidates({
      transactions: toPlaidMappedTransactions(data),
      paycheckAmount: plan.paycheckAmount,
      depositAccountExternalId: depositAccount?.externalAccountId ?? null,
    }).filter(
      (candidate) =>
        candidate.postedDate === postedDate &&
        Math.abs(candidate.amount - amount) / Math.max(amount, 1) <= 0.05,
    );

    const match = candidates[0];

    if (!match) {
      return null;
    }

    return {
      amount: match.amount,
      postedDate: match.postedDate,
      planId: plan.id,
      confidence: match.confidence,
    };
  }

  createHook(onApply: (match: DirectDepositMatch) => void): IncomePlanDirectDepositHook {
    return {
      promptLabel: "Paycheck detected. Apply your Income Plan?",
      onConfirm: onApply,
      onDismiss: () => {},
    };
  }
}

let dataAccessor: () => FinanceData | null = () => null;

export function configureIncomePlanPlaidDataAccessor(
  accessor: () => FinanceData | null,
): void {
  dataAccessor = accessor;
}

export const incomePlanPlaidService: IncomePlanPlaidService =
  new IncomePlanPlaidServiceImpl(() => dataAccessor());
