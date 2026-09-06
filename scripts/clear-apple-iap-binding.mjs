/**
 * Test/support-only: clear Buxme's stored Apple IAP ownership for one user.
 *
 * Usage:
 *   node --env-file=.env.local scripts/clear-apple-iap-binding.mjs --email=user@example.com
 *   node --env-file=.env.local scripts/clear-apple-iap-binding.mjs --user-id=<uuid>
 *   node --env-file=.env.local scripts/clear-apple-iap-binding.mjs --original-transaction-id=<otid>
 *
 * Does NOT delete Auth users.
 * Does NOT cancel Apple or Stripe subscriptions remotely.
 * Does NOT weaken duplicate-purchase protection.
 */
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).map((part) => {
    const [key, ...rest] = part.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const email = String(args.email || "").trim().toLowerCase();
const userId = String(args["user-id"] || args.userId || "").trim();
const originalTransactionId = String(
  args["original-transaction-id"] || args.originalTransactionId || "",
).trim();
const dryRun = args["dry-run"] === "true" || args.dryRun === "true";

if (!email && !userId && !originalTransactionId) {
  console.error(
    "Usage: node --env-file=.env.local scripts/clear-apple-iap-binding.mjs --email=... | --user-id=... | --original-transaction-id=... [--dry-run]",
  );
  process.exit(1);
}

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
  "id, email, subscription_plan, subscription_status, subscription_provider, stripe_subscription_id, apple_product_id, apple_original_transaction_id, apple_transaction_id, apple_environment";

let query = admin.from("profiles").select(SELECT);

if (userId) {
  query = query.eq("id", userId);
} else if (originalTransactionId) {
  query = query.eq("apple_original_transaction_id", originalTransactionId);
} else {
  query = query.ilike("email", email);
}

const { data: profile, error: findError } = await query.maybeSingle();

if (findError) {
  console.error("Lookup failed:", findError.message);
  process.exit(1);
}

if (!profile) {
  console.error("No profile found for the given selector.");
  process.exit(1);
}

const hasBinding = Boolean(
  profile.apple_original_transaction_id ||
    profile.apple_transaction_id ||
    profile.apple_product_id ||
    profile.apple_environment ||
    profile.subscription_provider === "apple",
);

if (!hasBinding) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "no_apple_iap_binding",
        profile,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

const before = { ...profile };
const now = new Date().toISOString();
const update = {
  apple_product_id: null,
  apple_original_transaction_id: null,
  apple_transaction_id: null,
  apple_environment: null,
  subscription_plan: "free",
  subscription_status: "none",
  subscription_provider: "none",
  subscription_current_period_end: null,
  updated_at: now,
};

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        wouldClear: before,
        update,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const { data: updated, error: updateError } = await admin
  .from("profiles")
  .update(update)
  .eq("id", profile.id)
  .select(SELECT)
  .maybeSingle();

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

const { error: logError } = await admin.from("admin_event_logs").insert({
  event_type: "auth",
  message: `Script cleared Apple IAP binding for ${profile.email ?? profile.id}`,
  metadata: {
    action: "clear_apple_iap_binding",
    supportOnly: true,
    userId: profile.id,
    email: profile.email,
    before: {
      appleProductId: before.apple_product_id,
      appleOriginalTransactionId: before.apple_original_transaction_id,
      appleTransactionId: before.apple_transaction_id,
      appleEnvironment: before.apple_environment,
      subscriptionProvider: before.subscription_provider,
      subscriptionPlan: before.subscription_plan,
      subscriptionStatus: before.subscription_status,
    },
    after: {
      appleProductId: null,
      appleOriginalTransactionId: null,
      appleTransactionId: null,
      appleEnvironment: null,
      subscriptionProvider: "none",
      subscriptionPlan: "free",
      subscriptionStatus: "none",
    },
    stripeSubscriptionIdPreserved: before.stripe_subscription_id,
    note: "Local Apple ownership columns cleared only. Auth user preserved. Remote Apple/Stripe subscriptions were not cancelled.",
    timestamp: now,
  },
  user_id: profile.id,
});

if (logError) {
  console.warn("Binding cleared but audit log insert failed:", logError.message);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      userId: profile.id,
      email: profile.email,
      before,
      after: updated,
      note: "Auth user preserved. Remote Apple/Stripe subscriptions were not cancelled.",
    },
    null,
    2,
  ),
);
