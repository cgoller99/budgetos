-- Persist notification preferences on user profiles (synced across devices).

alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{
    "bills": true,
    "goals": true,
    "household": true,
    "weeklySummary": true
  }'::jsonb;
