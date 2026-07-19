import { getSiteUrl } from "@/lib/supabase/authUrls";

export const LANDING_SEO = {
  title: "Buxme — Take Control of Every Dollar",
  description:
    "Buxme brings your accounts, bills, credit, goals, investments, and financial future together in one secure place.",
  tagline: "Take Control of Every Dollar.",
  keywords: [
    "personal finance",
    "budgeting app",
    "money management",
    "income plans",
    "financial health",
    "savings goals",
    "net worth tracker",
  ],
  ogImageAlt: "Buxme personal finance dashboard preview",
} as const;

export function getLandingPageUrl(): string {
  return getSiteUrl();
}

export function getLandingJsonLd() {
  const url = getLandingPageUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Buxme",
        url,
        description: LANDING_SEO.description,
        potentialAction: {
          "@type": "SearchAction",
          target: `${url}/register`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "Buxme",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description: LANDING_SEO.description,
        url,
      },
      {
        "@type": "Organization",
        name: "Buxme",
        url,
        contactPoint: {
          "@type": "ContactPoint",
          email: "support@buxme.co",
          contactType: "customer support",
        },
      },
    ],
  };
}
