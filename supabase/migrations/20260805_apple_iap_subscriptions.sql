-- Apple In-App Purchase entitlement fields for iOS App Store billing.
-- Web Stripe subscribers remain valid; native purchases write subscription_provider=apple.

alter table public.profiles
  add column if not exists subscription_provider text not null default 'none',
  add column if not exists apple_product_id text,
  add column if not exists apple_original_transaction_id text,
  add column if not exists apple_transaction_id text,
  add column if not exists apple_environment text;

create unique index if not exists profiles_apple_original_transaction_id_idx
  on public.profiles (apple_original_transaction_id)
  where apple_original_transaction_id is not null;

comment on column public.profiles.subscription_provider is
  'Entitlement source: none | stripe | apple';

-- Backfill existing Stripe subscribers so iOS recognizes web entitlements.
update public.profiles
set subscription_provider = 'stripe'
where coalesce(subscription_provider, 'none') = 'none'
  and stripe_subscription_id is not null
  and subscription_status in ('active', 'trialing', 'past_due');
