/**
 * Admin ops helper: set a single user's Buxme entitlement via service role.
 *
 * Usage:
 *   node --env-file=.env.local scripts/set-admin-entitlement.mjs --email=user@example.com --plan=free
 *
 * Plans: free | pro | pro_plus | founder
 *
 * Does NOT delete Auth users.
 * Does NOT cancel Stripe or Apple subscriptions remotely.
 */
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).map((part) => {
    const [key, ...rest] = part.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const email = String(args.email || "").trim().toLowerCase();
const plan = String(args.plan || "free").trim().toLowerCase();

if (!email || !["free", "pro", "pro_plus", "founder"].includes(plan)) {
  console.error(
    "Usage: node --env-file=.env.local scripts/set-admin-entitlement.mjs --email=user@example.com --plan=free|pro|pro_plus|founder",
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

const now = new Date().toISOString();

function buildUpdate(target) {
  if (target === "founder") {
    return { admin_founder_granted: true, updated_at: now };
  }

  if (target === "pro" || target === "pro_plus") {
    return {
      subscription_plan: target,
      subscription_status: "active",
      subscription_provider: "none",
      subscription_current_period_end: null,
      stripe_subscription_id: null,
      admin_founder_granted: false,
      apple_product_id: null,
      apple_original_transaction_id: null,
      apple_transaction_id: null,
      apple_environment: null,
      updated_at: now,
    };
  }

  return {
    subscription_plan: "free",
    subscription_status: "none",
    subscription_provider: "none",
    subscription_current_period_end: null,
    stripe_subscription_id: null,
    admin_founder_granted: false,
    apple_product_id: null,
    apple_original_transaction_id: null,
    apple_transaction_id: null,
    apple_environment: null,
    updated_at: now,
  };
}

const { data: profile, error: findError } = await admin
  .from("profiles")
  .select(
    "id, email, subscription_plan, subscription_status, subscription_provider, admin_founder_granted, stripe_subscription_id, apple_original_transaction_id, apple_product_id",
  )
  .ilike("email", email)
  .maybeSingle();

if (findError) {
  console.error("Lookup failed:", findError.message);
  process.exit(1);
}

if (!profile) {
  console.error(`No profile found for ${email}`);
  process.exit(1);
}

const before = { ...profile };
const update = buildUpdate(plan);

const { data: updated, error: updateError } = await admin
  .from("profiles")
  .update(update)
  .eq("id", profile.id)
  .select(
    "id, email, subscription_plan, subscription_status, subscription_provider, admin_founder_granted, stripe_subscription_id, apple_original_transaction_id, apple_product_id",
  )
  .maybeSingle();

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

const { error: logError } = await admin.from("admin_event_logs").insert({
  event_type: "auth",
  message: `Script set entitlement for ${email} to ${plan}`,
  metadata: {
    action: "script_set_entitlement",
    email,
    userId: profile.id,
    oldPlan: before.subscription_plan,
    newPlan: plan,
    oldProvider: before.subscription_provider,
    hadApple: Boolean(before.apple_original_transaction_id),
    hadStripe: Boolean(before.stripe_subscription_id),
    timestamp: now,
  },
  user_id: profile.id,
});

if (logError) {
  console.warn("Entitlement updated but audit log insert failed:", logError.message);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      email,
      userId: profile.id,
      before,
      after: updated,
      note:
        "Auth user preserved. Remote Apple/Stripe subscriptions were not cancelled. Active external subs may restore paid entitlement on sync/restore.",
    },
    null,
    2,
  ),
);
