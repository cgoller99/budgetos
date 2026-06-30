import type { PlaidMappedTransaction, PlaidPayrollCandidate } from "@/lib/plaid/types";
import { detectPlaidPayrollCandidates } from "@/lib/plaid/mappers";

export function detectPayrollCandidates(params: {
  transactions: PlaidMappedTransaction[];
  paycheckAmount: number;
  depositAccountExternalId?: string | null;
  referenceDate?: Date;
}): PlaidPayrollCandidate[] {
  return detectPlaidPayrollCandidates(params);
}
