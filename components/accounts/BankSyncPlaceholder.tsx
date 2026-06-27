"use client";

import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { bankSyncComingSoonMessage } from "@/lib/integrations/bankSync";

export function BankSyncPlaceholder() {
  return (
    <Card padding="lg">
      <CardHeader
        title="Connect bank"
        action={<Badge variant="warning">Coming soon</Badge>}
      />
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-white/55">
          {bankSyncComingSoonMessage}
        </p>
        <ul className="space-y-2 text-sm text-white/45">
          <li>Automatically import account balances</li>
          <li>Sync transactions into BudgetOS</li>
          <li>Keep manual entry available at any time</li>
        </ul>
        <Button variant="secondary" disabled>
          Connect bank
        </Button>
      </CardContent>
    </Card>
  );
}
