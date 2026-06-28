import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/supabase/authUrls";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BudgetOS",
    short_name: "BudgetOS",
    description: "Your premium personal finance command center.",
    start_url: getSiteUrl(),
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#0077ed",
  };
}
