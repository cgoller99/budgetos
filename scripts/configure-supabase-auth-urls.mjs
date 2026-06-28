#!/usr/bin/env node
/**
 * Prints Supabase Auth URL configuration for Buxme production.
 * Apply manually in Supabase Dashboard → Authentication → URL Configuration
 * unless SUPABASE_ACCESS_TOKEN is set (Management API).
 */

const SITE_URL = "https://buxme.co";
const REDIRECT_URLS = [
  `${SITE_URL}/auth/callback`,
  `${SITE_URL}/auth/confirm`,
  `${SITE_URL}/**`,
  "http://localhost:3000/auth/callback",
  "http://localhost:3000/auth/confirm",
  "http://localhost:3000/**",
];

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
  /https:\/\/([^.]+)\.supabase\.co/,
)?.[1];

console.log("Supabase Auth URL configuration for Buxme\n");
console.log("Site URL:", SITE_URL);
console.log("\nRedirect URLs (add each):");
for (const url of REDIRECT_URLS) {
  console.log(" -", url);
}

async function tryManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || !PROJECT_REF) {
    console.log(
      "\nSet SUPABASE_ACCESS_TOKEN to auto-apply via Management API, or paste the URLs above in the dashboard.",
    );
    return;
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        site_url: SITE_URL,
        uri_allow_list: REDIRECT_URLS.join(","),
      }),
    },
  );

  const body = await response.text();
  if (!response.ok) {
    console.error("\nManagement API update failed:", response.status, body);
    return;
  }

  console.log("\nManagement API update succeeded.");
}

tryManagementApi().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
