-- Run once in the project's Supabase SQL editor, or with supabase db push.
-- Existing expenses/income/notifications tables remain the source of truth.
begin;

create table public.spending_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'income_percent' check (mode in ('fixed', 'income_percent')),
  amount_cad numeric(12,2),
  income_percent integer not null default 80 check (income_percent between 1 and 100),
  warning_percent integer not null default 80 check (warning_percent between 50 and 99),
  enabled boolean not null default true,
  timezone text not null default 'UTC',
  check (mode <> 'fixed' or (amount_cad is not null and amount_cad > 0 and amount_cad <= 9999999999.99))
);
alter table public.spending_limits enable row level security;
create policy "Manage own spending limit" on public.spending_limits
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.spending_limits to authenticated;
grant all on public.spending_limits to service_role;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "Read own push devices" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "Remove own push devices" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- Atomic device registration avoids losing deliveries when the same account
-- re-enables a subscription, and prevents shared devices having two owners.
create function public.register_spending_push(p_user_id uuid, p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare device_id uuid;
begin
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
    values (p_user_id, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
    returning id into device_id;
  delete from public.spending_push_deliveries where subscription_id = device_id and user_id <> p_user_id;
end;
$$;
revoke all on function public.register_spending_push(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.register_spending_push(uuid, text, text, text) to service_role;

create table public.spending_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('warning', 'reached')),
  period date not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id, subscription_id)
);
alter table public.spending_push_deliveries enable row level security;
-- Delivery credentials and queue operations are only available to the server.
grant all on public.spending_push_deliveries to service_role;
create index spending_push_pending_idx on public.spending_push_deliveries(available_at)
  where sent_at is null and attempts < 5;

create function public.validate_spending_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone';
  end if;
  return new;
end;
$$;
create trigger spending_limit_timezone before insert or update on public.spending_limits
  for each row execute function public.validate_spending_timezone();

-- Internal helper is intentionally not callable by browser roles. Row locking
-- serializes evaluations for one account, including edits from multiple devices.
create function public.evaluate_spending_limit(p_user_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  settings public.spending_limits%rowtype;
  today date;
  period_start date;
  spent numeric;
  earned numeric;
  boundary numeric;
  alert_level text;
  alert_id uuid;
  alert_title text;
  alert_body text;
begin
  select * into settings from public.spending_limits where user_id = p_user_id for update;
  if not found or not settings.enabled then
    delete from public.spending_push_deliveries where user_id = p_user_id and sent_at is null;
    return 0;
  end if;
  today := (now() at time zone settings.timezone)::date;
  period_start := date_trunc('month', today)::date;
  select coalesce(sum(round(amount_cad::numeric, 2)), 0) into spent
    from public.expenses where user_id = p_user_id and date between period_start and today;
  select coalesce(sum(round(amount_cad::numeric, 2)), 0) into earned
    from public.income where user_id = p_user_id and date between period_start and today;
  boundary := case when settings.mode = 'fixed' then settings.amount_cad
    else round(earned * settings.income_percent / 100, 2) end;
  alert_level := case when boundary <= 0 then null when spent >= boundary then 'reached'
    when spent * 100 >= boundary * settings.warning_percent then 'warning' else null end;

  -- Don't deliver obsolete warnings after corrections, income changes, pausing,
  -- or month rollover. Historical in-app alerts remain a record of what happened.
  delete from public.spending_push_deliveries where user_id = p_user_id and sent_at is null
    and (period <> period_start or alert_level is null or spending_push_deliveries.level <> alert_level);
  if alert_level is null then return 0; end if;
  if alert_level = 'warning' and exists (
    select 1 from public.notifications where user_id = p_user_id
      and dedupe_key = 'spending_limit:' || to_char(period_start, 'YYYY-MM') || ':reached'
  ) then return 0; end if;
  if alert_level = 'reached' then
    alert_title := case when spent > boundary then 'You’ve exceeded your spending limit' else 'You’ve reached your spending limit' end;
  else
    alert_title := 'You’re approaching your spending limit';
  end if;
  alert_body := 'You’ve spent CAD ' || to_char(spent, 'FM999999999999990.00')
    || ' of your CAD ' || to_char(boundary, 'FM999999999999990.00') || ' monthly limit. '
    || case when spent > boundary then 'That’s CAD ' || to_char(spent - boundary, 'FM999999999999990.00') || ' over your limit.'
      else 'CAD ' || to_char(boundary - spent, 'FM999999999999990.00') || ' remains.' end;

  -- Use the existing supported budget notification type. Two separate dedupe
  -- keys preserve a read warning when the user later reaches the actual limit.
  insert into public.notifications(user_id, title, body, type, is_read, dedupe_key)
    values (p_user_id, alert_title, alert_body, 'budget_exceeded', false,
      'spending_limit:' || to_char(period_start, 'YYYY-MM') || ':' || alert_level)
    on conflict (user_id, dedupe_key) do nothing returning id into alert_id;
  if alert_id is null then return 0; end if;
  insert into public.spending_push_deliveries(notification_id, subscription_id, user_id, level, period)
    select alert_id, id, p_user_id, alert_level, period_start from public.push_subscriptions where user_id = p_user_id;
  return 1;
end;
$$;
revoke all on function public.evaluate_spending_limit(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_spending_limit(uuid) to service_role;

create function public.check_my_spending_limit() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return public.evaluate_spending_limit(auth.uid());
end;
$$;
revoke all on function public.check_my_spending_limit() from public, anon;
grant execute on function public.check_my_spending_limit() to authenticated;

create function public.spending_limit_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.evaluate_spending_limit(old.user_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.evaluate_spending_limit(old.user_id);
  end if;
  perform public.evaluate_spending_limit(new.user_id);
  return new;
end;
$$;
revoke all on function public.spending_limit_changed() from public, anon, authenticated;
create trigger spending_limit_expenses after insert or update or delete on public.expenses
  for each row execute function public.spending_limit_changed();
create trigger spending_limit_income after insert or update or delete on public.income
  for each row execute function public.spending_limit_changed();
create trigger spending_limit_settings after insert or update or delete on public.spending_limits
  for each row execute function public.spending_limit_changed();

-- The scheduled server worker also evaluates newly due dates and month changes.
create function public.check_all_spending_limits() returns void
language plpgsql security definer set search_path = '' as $$
declare account record;
begin
  for account in select user_id from public.spending_limits where enabled order by user_id loop
    perform public.evaluate_spending_limit(account.user_id);
  end loop;
end;
$$;
revoke all on function public.check_all_spending_limits() from public, anon, authenticated;
grant execute on function public.check_all_spending_limits() to service_role;

create function public.claim_spending_push(p_user_id uuid default null)
returns table (id uuid, subscription_id uuid, endpoint text, p256dh text, auth text, level text, attempts integer)
language sql security definer set search_path = '' as $$
  with pending as (
    select d.id from public.spending_push_deliveries d
    where d.sent_at is null and d.attempts < 5 and d.available_at <= now()
      and (p_user_id is null or d.user_id = p_user_id)
    order by d.available_at limit 20 for update skip locked
  ), claimed as (
    update public.spending_push_deliveries d set attempts = d.attempts + 1, available_at = now() + interval '5 minutes'
    from pending where d.id = pending.id
    returning d.id, d.subscription_id, d.level, d.attempts
  )
  select c.id, s.id, s.endpoint, s.p256dh, s.auth, c.level, c.attempts
    from claimed c join public.push_subscriptions s on s.id = c.subscription_id;
$$;
revoke all on function public.claim_spending_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_spending_push(uuid) to service_role;

commit;
