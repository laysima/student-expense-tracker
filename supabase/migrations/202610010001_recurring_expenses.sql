-- Automatic renewal of recurring expenses (subscriptions, rent, phone bills).
-- Run once in Supabase → SQL Editor. Safe to re-run; only adds columns.
--
-- The row marked recurring is the template. Each charge logged from it is a
-- normal expense whose recurring_source_id points back at the template.
-- renewed_through records the last charge logged, so deleting one renewal
-- doesn't make it reappear.

alter table public.expenses
  add column if not exists recurring_source_id uuid references public.expenses (id) on delete set null;

alter table public.expenses
  add column if not exists renewed_through date;

-- One charge per template per day, even if two tabs load at the same moment.
-- NULLs never collide, so ordinary expenses are unaffected.
create unique index if not exists expenses_recurring_occurrence_idx
  on public.expenses (recurring_source_id, date);
