-- Persist onboarding state on profiles (replaces localStorage)

alter table public.profiles
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists onboarding_mode text,
  add column if not exists demo_profile_id text;
