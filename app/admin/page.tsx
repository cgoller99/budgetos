import { forbidden, redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminBetaSection } from "@/components/admin/AdminBetaSection";
import { AdminReleasesSection } from "@/components/admin/AdminReleasesSection";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPageUser } from "@/lib/admin/apiAuth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await requireAdminPageUser();

  if ("misconfigured" in auth) {
    return (
      <AdminShell>
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-8 text-sm text-white/70">
          Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment, then restart the
          dev server.
        </div>
      </AdminShell>
    );
  }

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
