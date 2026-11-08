import { forbidden, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { JarvisHeadquarters } from "@/components/admin/JarvisHeadquarters";
import { requireAdminPageUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";
export default async function JarvisPage() {
  const auth = await requireAdminPageUser();
  if ("misconfigured" in auth) return <AdminShell><p className="p-8">Admin backend is not configured.</p></AdminShell>;
  if ("unauthorized" in auth) redirect("/login?redirect=/admin/jarvis");
  if ("forbidden" in auth) forbidden();
  return <AdminShell><JarvisHeadquarters /></AdminShell>;
}
