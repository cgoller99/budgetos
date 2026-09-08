import type { Metadata } from "next";
import { SupportPageContent } from "@/components/support/SupportPageContent";
import { getSiteUrl } from "@/lib/supabase/authUrls";

const pageUrl = `${getSiteUrl()}/support`;

export const metadata: Metadata = {
  title: "Buxme Support",
  description:
    "Get help with your Buxme account, connected accounts, transactions, bills, income plans, debt, investments, and more.",
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "Buxme",
    title: "Buxme Support",
    description:
      "Help center and contact options for Buxme accounts, bank connections, bills, income planning, and more.",
  },
  twitter: {
    card: "summary",
    title: "Buxme Support",
    description:
      "Help center and contact options for Buxme accounts, bank connections, bills, income planning, and more.",
  },
  alternates: {
    canonical: pageUrl,
  },
};

export default function SupportPage() {
  return <SupportPageContent />;
}
