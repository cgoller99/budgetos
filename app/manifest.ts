import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/supabase/authUrls";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Buxme",
    short_name: "Buxme",
    description: "Everything about your money.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f14",
    theme_color: "#3b82f6",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
