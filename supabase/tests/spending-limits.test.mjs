import assert from 'node:assert/strict'
import { before, beforeEach, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const user = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const rows = async sql => (await db.query(sql)).rows
const count = async table => Number((await rows(`select count(*) as n from public.${table}`))[0].n)
const limit = async (mode = 'fixed', amount = '100', owner = user) => db.exec(`insert into public.spending_limits(user_id, mode, amount_cad) values ('${owner}','${mode}',${amount})`)
const spend = async (amount, date = 'current_date', owner = user) => db.exec(`insert into public.expenses(user_id,amount_cad,date) values ('${owner}',${amount},${date})`)
const earn = async amount => db.exec(`insert into public.income(user_id,amount_cad,date) values ('${user}',${amount},current_date)`)
const subscribe = async () => db.exec(`insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values ('${user}','https://fcm.googleapis.com/test','key','auth')`)

before(async () => {
  // Minimal existing app schema. PGlite runs the actual PostgreSQL migration,
  // including PL/pgSQL triggers, unique constraints, grants, and RLS policies.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    create table public.expenses(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), amount_cad numeric(12,2), date date);
    create table public.income(like public.expenses including all);
    create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), title text, body text,
      type text check(type in ('payment_due','budget_exceeded','ai_insight','savings_goal')), dedupe_key text, is_read boolean default false,
      created_at timestamptz default now(), unique(user_id,dedupe_key));
    insert into auth.users values ('${user}'), ('${other}');
  `)
  await db.exec(await readFile(new URL('../migrations/202609080001_spending_limits.sql', import.meta.url), 'utf8'))
})
beforeEach(async () => db.exec('reset role; truncate public.spending_push_deliveries, public.push_subscriptions, public.spending_limits, public.expenses, public.income, public.notifications cascade;'))
after(async () => db.close())

test('warning fires at 80%, once, and reaching 100% creates a separate unread alert', async () => {
  await limit(); await subscribe(); await spend(79.99)
  assert.equal(await count('notifications'), 0)
  await spend(.01)
  assert.equal(await count('notifications'), 1)
  await db.exec('update public.notifications set is_read = true')
  await spend(.01)
  await db.exec(`select public.evaluate_spending_limit('${user}')`)
  assert.equal(await count('notifications'), 1)
  assert.equal((await rows('select is_read from public.notifications'))[0].is_read, true)
  await spend(19.99)
  assert.equal(await count('notifications'), 2)
  const reached = (await rows("select * from public.notifications where dedupe_key like '%:reached'"))[0]
  assert.equal(reached.is_read, false)
  assert.match(reached.title, /reached/)
  // The undelivered 80% warning is superseded by the 100% alert.
  assert.equal(await count('spending_push_deliveries'), 1)
  assert.equal((await rows('select level from public.spending_push_deliveries'))[0].level, 'reached')
})

test('a large first expense only creates the exceeded alert, with correct amounts', async () => {
  await limit(); await spend(125.25)
  const alerts = await rows('select * from public.notifications')
  assert.equal(alerts.length, 1)
  assert.match(alerts[0].title, /exceeded/)
  assert.match(alerts[0].body, /CAD 25.25 over/)
})

test('edits and deletions recalculate totals and cancel obsolete queued alerts', async () => {
  await limit(); await subscribe(); await spend(10)
  await db.exec('update public.expenses set amount_cad = 85')
  assert.equal(await count('notifications'), 1)
  assert.equal(await count('spending_push_deliveries'), 1)
  await db.exec('delete from public.expenses')
  assert.equal(await count('spending_push_deliveries'), 0)
  assert.equal(await count('notifications'), 1)
})

test('income-based limit waits for income, and changes as income is edited or deleted', async () => {
  await limit('income_percent', 'null'); await subscribe(); await spend(70)
  assert.equal(await count('notifications'), 0)
  await earn(100)
  assert.equal(await count('notifications'), 1)
  assert.match((await rows('select body from public.notifications'))[0].body, /CAD 80.00 monthly limit/)
  await db.exec('update public.income set amount_cad = 200')
  assert.equal(await count('spending_push_deliveries'), 0)
  await db.exec('update public.income set amount_cad = 50')
  assert.equal(await count('notifications'), 2)
  await db.exec('delete from public.income')
  assert.equal(await count('spending_push_deliveries'), 0)
})

test('future dates and previous months do not count; alert keys reset each month', async () => {
  await limit()
  await spend(1000, "(date_trunc('month',current_date) - interval '1 day')::date")
  await spend(1000, "(current_date + interval '1 day')::date")
  assert.equal(await count('notifications'), 0)
  await db.exec(`insert into public.notifications(user_id,title,type,dedupe_key) values ('${user}','Old warning','budget_exceeded',
    'spending_limit:' || to_char(current_date - interval '1 month','YYYY-MM') || ':warning')`)
  await spend(80)
  assert.equal(await count('notifications'), 2)
})

test('saved limits evaluate existing spending immediately and custom warning thresholds work', async () => {
  await spend(85); await limit()
  assert.equal(await count('notifications'), 1)
  await limit('fixed', '100', other)
  await db.exec(`update public.spending_limits set warning_percent = 90 where user_id = '${other}'`)
  await spend(89.99, 'current_date', other)
  assert.equal(await count('notifications'), 1)
  await spend(.01, 'current_date', other)
  assert.equal(await count('notifications'), 2)
})

test('pausing cancels pending pushes; resuming does not repeat an existing monthly alert', async () => {
  await limit(); await subscribe(); await spend(80)
  await db.exec('update public.spending_limits set enabled = false')
  assert.equal(await count('spending_push_deliveries'), 0)
  await spend(5)
  await db.exec('update public.spending_limits set enabled = true')
  assert.equal(await count('notifications'), 1)
  assert.equal(await count('spending_push_deliveries'), 0)
})

test('a reached alert is not followed by a lower-severity warning after an income increase', async () => {
  await limit('income_percent', 'null'); await earn(100); await spend(100)
  await earn(50)
  assert.equal(await count('notifications'), 1)
})

test('push claims are leased, retried up to five times, and can be scoped to one account', async () => {
  await limit(); await subscribe(); await spend(80)
  assert.equal((await rows(`select * from public.claim_spending_push('${other}')`)).length, 0)
  assert.equal((await rows(`select * from public.claim_spending_push('${user}')`)).length, 1)
  assert.equal((await rows('select * from public.claim_spending_push()')).length, 0)
  for (let attempt = 2; attempt <= 5; attempt++) {
    await db.exec("update public.spending_push_deliveries set available_at = now() - interval '1 second'")
    assert.equal((await rows('select * from public.claim_spending_push()'))[0].attempts, attempt)
  }
  await db.exec("update public.spending_push_deliveries set available_at = now() - interval '1 second'")
  assert.equal((await rows('select * from public.claim_spending_push()')).length, 0)
})

test('device registration preserves same-account delivery and clears a previous account’s queue', async () => {
  await limit(); await subscribe(); await spend(80)
  await db.exec(`select public.register_spending_push('${user}','https://fcm.googleapis.com/test','new','new')`)
  assert.equal(await count('spending_push_deliveries'), 1)
  await db.exec(`select public.register_spending_push('${other}','https://fcm.googleapis.com/test','new','new')`)
  assert.equal(await count('spending_push_deliveries'), 0)
  assert.equal(await count('push_subscriptions'), 1)
  assert.equal((await rows('select user_id from public.push_subscriptions'))[0].user_id, other)
})

test('RLS isolates settings and only service-role workers may access delivery functions', async () => {
  await limit(); await limit('fixed', '200', other)
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false)`)
  assert.equal((await rows('select * from public.spending_limits')).length, 1)
  await assert.rejects(db.exec(`insert into public.spending_limits(user_id) values ('${other}')`))
  await assert.rejects(db.exec(`select public.evaluate_spending_limit('${other}')`), /permission denied/)
  await assert.rejects(db.exec('select public.check_all_spending_limits()'), /permission denied/)
  await assert.rejects(db.exec('select public.claim_spending_push()'), /permission denied/)
  await assert.rejects(db.exec('select * from public.spending_push_deliveries'), /permission denied/)
  await db.exec('select public.check_my_spending_limit()')
})

test('database constraints reject zero/null fixed limits, invalid percentages and timezones', async () => {
  await assert.rejects(limit('fixed', 'null'))
  await assert.rejects(limit('fixed', '0'))
  await limit()
  await assert.rejects(db.exec('update public.spending_limits set warning_percent = 100'))
  await assert.rejects(db.exec("update public.spending_limits set timezone = 'not/a-zone'"))
})
