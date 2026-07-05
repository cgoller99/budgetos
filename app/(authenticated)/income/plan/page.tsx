import { redirect } from "next/navigation";

export default function IncomePlanRedirectPage() {
  redirect("/income?tab=plan");
}
