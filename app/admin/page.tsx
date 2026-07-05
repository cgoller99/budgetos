import { forbidden, redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminBetaSection } from "@/components/admin/AdminBetaSection";
import { AdminReleasesSection } from "@/components/admin/AdminReleasesSection";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPageUser } from "@/lib/admin/apiAuth";

export default async function AdminPage() {
  const auth = await requireAdminPageUser();

  if ("unauthorized" in auth) {
    redirect("/login?redirect=/admin");
  }

  if ("forbidden" in auth) {
    forbidden();
  }

  return (
    <AdminShell>
      <AdminDashboard />
      <div className="mt-16 border-t border-[var(--surface-border)] pt-16">
        <AdminReleasesSection />
      </div>
      <div className="mt-16 border-t border-[var(--surface-border)] pt-16">
        <AdminBetaSection />
      </div>
    </AdminShell>
  );
}
