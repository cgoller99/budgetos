"use client";

import { Card, CardContent, CardHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/finance/format";
import { getBillPaymentHistory } from "@/lib/finance/billPayments";
import type { Bill, FinanceData } from "@/lib/finance/types";

type BillPaymentHistoryProps = {
  bill: Bill;
  data: FinanceData;
};

export function BillPaymentHistory({ bill, data }: BillPaymentHistoryProps) {
  const payments = getBillPaymentHistory(data, bill.id);

  if (payments.length === 0) {
    return null;
  }

  return (
    <Card padding="default" className="mt-4">
      <CardHeader title="Payment history" />
      <CardContent>
        <ul className="space-y-3">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  {payment.notes || bill.name}
                </p>
                <p className="mt-0.5 text-xs text-white/38">
                  {new Date(payment.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" · "}
                  {payment.category}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
                {formatCurrency(payment.amount)}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
