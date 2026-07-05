import { Suspense } from "react";
import { IncomeHubContent } from "@/components/income/IncomeHubContent";
import { SkeletonGrid } from "@/components/ui";

export default function IncomePage() {
  return (
    <Suspense fallback={<SkeletonGrid count={4} />}>
      <IncomeHubContent />
    </Suspense>
  );
}
