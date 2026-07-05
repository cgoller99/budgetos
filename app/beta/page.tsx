import type { Metadata } from "next";
import { BetaPageContent } from "@/components/beta/BetaPageContent";

export const metadata: Metadata = {
  title: "Join the Buxme Beta",
  description:
    "Join the Buxme public beta. Free during beta. Help shape income plans, financial health, and household finance.",
};

export default function BetaPage() {
  return <BetaPageContent />;
}
