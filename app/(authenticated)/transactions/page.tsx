import { TransactionsContent } from "@/components/transactions/TransactionsContent";

export default function TransactionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:gap-10">
      <TransactionsContent />
    </div>
  );
}
