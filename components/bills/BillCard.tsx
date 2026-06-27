"use client";

import { Badge, Button, Card, CardContent } from "@/components/ui";
import { formatCurrency } from "@/lib/finance/format";
import { getBillStatusVariant } from "@/lib/finance/bills";
import type { BillProgress } from "@/lib/finance/types";

type BillCardProps = {
  bill: BillProgress;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
};

export function BillCard({
  bill,
  onEdit,
  onDelete,
  onMarkPaid,
}: BillCardProps) {
  const isPaid = bill.status === "paid";

  return (
    <Card hover className="bill-card-enter overflow-hidden">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="truncate text-lg font-semibold tracking-tight text-white">
                {bill.name}
              </h3>
              <Badge variant={getBillStatusVariant(bill.status)}>
                {bill.statusLabel}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-white/38">
              {bill.formattedDueDate}
              {bill.recurring ? " · Recurring" : ""}
              {bill.autopay ? " · Autopay" : ""}
            </p>
          </div>
          <p className="shrink-0 text-xl font-semibold tabular-nums text-white">
            {formatCurrency(bill.amount)}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-white/[0.04] pt-6">
          <Button
            type="button"
            onClick={onMarkPaid}
            disabled={isPaid}
          >
            Mark paid
          </Button>
          <Button type="button" variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="text-rose-400/90 hover:text-rose-300"
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
