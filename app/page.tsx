import type { Metadata } from "next";
import { HomeGate } from "@/components/landing/HomeGate";
import {
  LANDING_SEO,
  getLandingJsonLd,
  getLandingPageUrl,
} from "@/lib/landing/seo";

const pageUrl = getLandingPageUrl();

export const metadata: Metadata = {
  title: LANDING_SEO.title,
  description: LANDING_SEO.description,
  keywords: [...LANDING_SEO.keywords],
  openGraph: {
    type: "website",
    url: pageUrl,
    siteName: "Buxme",
    title: LANDING_SEO.title,
    description: LANDING_SEO.description,
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_SEO.title,
    description: LANDING_SEO.description,
  },
  alternates: {
    canonical: pageUrl,
  },
};

export default function Home() {
  const jsonLd = getLandingJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeGate />
    </>
  );
}
