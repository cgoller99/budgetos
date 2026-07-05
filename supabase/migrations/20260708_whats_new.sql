-- What's New / Release Notes system

create type release_change_category as enum (
  'feature',
  'improvement',
  'bugfix',
  'security',
  'performance'
);

create table if not exists app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  release_date date not null,
  title text not null,
  summary text not null default '',
  published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists app_release_changes (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references app_releases(id) on delete cascade,
  category release_change_category not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists app_release_changes_release_id_idx
  on app_release_changes(release_id);

create table if not exists user_release_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references app_releases(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

create index if not exists app_releases_published_date_idx
  on app_releases(published, release_date desc);

alter table app_releases enable row level security;
alter table app_release_changes enable row level security;
alter table user_release_views enable row level security;

create policy app_releases_read_published
  on app_releases for select
  to authenticated
  using (published = true);

create policy app_release_changes_read_published
  on app_release_changes for select
  to authenticated
  using (
    exists (
      select 1 from app_releases r
      where r.id = release_id and r.published = true
    )
  );

create policy user_release_views_select_own
  on user_release_views for select
  to authenticated
  using (auth.uid() = user_id);

create policy user_release_views_insert_own
  on user_release_views for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Seed launch release (published)
insert into app_releases (
  version,
  release_date,
  title,
  summary,
  published,
  featured,
  published_at
) values (
  '1.0.0',
  '2026-07-01',
  'Buxme Launch Readiness',
  'Unified financial engine, automatic paycheck plans, and a clearer mobile experience.',
  true,
  true,
  now()
) on conflict (version) do nothing;

insert into app_release_changes (release_id, category, description, sort_order)
select r.id, v.category::release_change_category, v.description, v.sort_order
from app_releases r
cross join (
  values
    ('feature', 'Income Plan auto-run on your pay schedule', 0),
    ('feature', 'Allocation ledger with full audit history', 1),
    ('improvement', 'Faster dashboard with unified calculations', 2),
    ('improvement', 'Better mobile navigation with More menu', 3),
    ('bugfix', 'Fixed Safe To Spend inconsistencies across pages', 4),
    ('security', 'Security and access control improvements', 5),
    ('performance', 'Reduced dashboard loading time', 6)
) as v(category, description, sort_order)
where r.version = '1.0.0'
  and not exists (
    select 1 from app_release_changes c where c.release_id = r.id
  );
