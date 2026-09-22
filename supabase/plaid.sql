-- Plaid bank connections for Xtrack.
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- plaid_items: one row per linked bank login.
--
-- access_token is a long-lived credential to the user's bank data. RLS is
-- enabled with NO policies on purpose: the browser (anon key) can never read,
-- write or even count these rows. Only server routes using the service-role
-- key touch this table, and they always filter by the signed-in user's id.
-- ---------------------------------------------------------------------------
create table if not exists public.plaid_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  item_id          text not null unique,
  access_token     text not null,
  institution_name text,
  cursor           text,
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.plaid_items enable row level security;
create index if not exists plaid_items_user_id_idx on public.plaid_items (user_id);

-- ---------------------------------------------------------------------------
-- bank_transactions: imported transactions waiting for review.
--
-- Nothing lands in expenses/income automatically. Each row starts 'pending';
-- the user imports it (creating a real expense or income row) or dismisses it
-- (e.g. a transfer between their own accounts, or something already logged).
-- Users can read and update their own rows; inserts come from the server.
-- ---------------------------------------------------------------------------
create table if not exists public.bank_transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  item_id              text not null,
  plaid_transaction_id text not null unique,
  account_id           text,
  name                 text not null,
  merchant_name        text,
  amount_cad           numeric(12, 2) not null check (amount_cad >= 0),
  direction            text not null check (direction in ('out', 'in')),
  date                 date not null,
  plaid_category       text,
  suggested_category   text,
  is_transfer          boolean not null default false,
  status               text not null default 'pending'
                         check (status in ('pending', 'imported', 'dismissed')),
  created_at           timestamptz not null default now()
);

alter table public.bank_transactions enable row level security;
create index if not exists bank_transactions_user_status_idx
  on public.bank_transactions (user_id, status);

-- Postgres has no "create policy if not exists", so check first. This keeps
-- the script re-runnable without any DROP statements.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bank_transactions'
      and policyname = 'bank_transactions: read own'
  ) then
    create policy "bank_transactions: read own"
      on public.bank_transactions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bank_transactions'
      and policyname = 'bank_transactions: update own'
  ) then
    create policy "bank_transactions: update own"
      on public.bank_transactions for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
