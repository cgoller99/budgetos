import { DashboardContent } from "@/components/DashboardContent";
import { PageAnalytics } from "@/components/analytics/PageAnalytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export default function DashboardPage() {
  return (
    <>
      <PageAnalytics event={ANALYTICS_EVENTS.OPENED_DASHBOARD} />
      <DashboardContent />
    </>
  );
}
