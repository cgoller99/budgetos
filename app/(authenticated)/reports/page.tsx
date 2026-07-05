import { ReportsContent } from "@/components/reports/ReportsContent";
import { PageAnalytics } from "@/components/analytics/PageAnalytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export default function ReportsPage() {
  return (
    <>
      <PageAnalytics event={ANALYTICS_EVENTS.VIEWED_REPORTS} />
      <ReportsContent />
    </>
  );
}
