-- Explicit Income Plan → income source ownership link for projection dedupe.
-- Income sources are stored as transactions rows with transaction_type = 'income'.

alter table public.income_plans
  add column if not exists linked_income_source_id uuid
    references public.transactions (id) on delete set null;

create index if not exists income_plans_linked_income_source_id_idx
  on public.income_plans (linked_income_source_id)
  where linked_income_source_id is not null;
