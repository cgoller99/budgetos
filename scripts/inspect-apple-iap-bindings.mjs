/**
 * Inspect production Apple IAP ownership rows on public.profiles (read-only).
 *
 * Usage:
 *   node --env-file=.env.local scripts/inspect-apple-iap-bindings.mjs
 *   node --env-file=.env.local scripts/inspect-apple-iap-bindings.mjs --email=user@example.com
 */
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).map((part) => {
    const [key, ...rest] = part.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const email = String(args.email || "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SELECT =
  "id, email, subscription_plan, subscription_status, subscription_provider, apple_product_id, apple_original_transaction_id, apple_transaction_id, apple_environment, updated_at";

const { data: bound, error: boundError } = await admin
  .from("profiles")
  .select(SELECT)
  .or(
    "apple_original_transaction_id.not.is.null,apple_transaction_id.not.is.null,apple_product_id.not.is.null,subscription_provider.eq.apple",
  )
  .order("updated_at", { ascending: false })
  .limit(100);

if (boundError) {
  console.error("Bound profiles query failed:", boundError.message);
  process.exit(1);
}

let focused = null;
if (email) {
  const { data, error } = await admin
    .from("profiles")
    .select(SELECT)
    .ilike("email", email)
    .maybeSingle();
  if (error) {
    console.error("Email lookup failed:", error.message);
    process.exit(1);
  }
  focused = data;
}

console.log(
  JSON.stringify(
    {
      projectUrl: url,
      boundProfileCount: bound?.length ?? 0,
      boundProfiles: bound ?? [],
      focusedEmail: email || null,
      focusedProfile: focused,
    },
    null,
    2,
  ),
);
