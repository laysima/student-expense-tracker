# Spending limits and notifications

The dashboard's **Monthly spending limit** card supports a fixed CAD amount or a percentage of income recorded in the current month. The defaults are an 80% income allocation and a warning at 80% of that limit. These are editable preferences, not financial recommendations. At 100%, a separate notification says the limit has been reached (or exceeded).

The same settings repeat each calendar month in the timezone saved when the user creates the limit. Previous months and future-dated entries do not count. Recurring entries count only as recorded transactions, without projecting future pay. Income-based limits wait for positive recorded income and recalculate when income changes. Category budgets remain separate.

## Enable in-app alerts

Apply [the migration](../supabase/migrations/202609080001_spending_limits.sql) to the existing Supabase project using its SQL editor, or your Supabase CLI migration workflow. It expects the app's existing `expenses`, `income`, and `notifications` tables, UUID user/notification IDs, and the existing unique `(user_id, dedupe_key)` notification constraint. It retains the existing `budget_exceeded` notification type.

The migration creates settings, device subscriptions, an alert delivery queue, RLS policies, and database triggers. Adding, editing, or deleting expenses/income and saving a limit evaluate the current month inside the transaction. No AI or API credits are required. A missing migration does not break the rest of the dashboard; saving a spending limit reports a failure until it is applied.

Each account receives at most one warning and one reached notification per calendar month. A transaction that jumps straight over the limit creates only the reached/exceeded notification. Reading an alert never resets it. Changes to settings, corrections, or new income can cancel obsolete queued pushes, but historical in-app notifications remain. Changing thresholds or pausing/resuming does not reset monthly deduplication.

## Enable notifications outside the app

In-app alerts work without push credentials. Device delivery requires the migration, an HTTPS deployment (localhost is supported for development), these **server-only** environment variables, and the scheduled worker below:

| Variable | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Project service-role key; never expose it with a `NEXT_PUBLIC_` prefix |
| `VAPID_PUBLIC_KEY` | Public key generated with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Matching private key; keep the pair stable across deployments |
| `VAPID_SUBJECT` | Your actual support `mailto:` address or public HTTPS contact URL |
| `CRON_SECRET` | A random secret, for example generated with `openssl rand -hex 32` |

The app also uses its existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `/api/push-subscriptions` exposes only the public VAPID key to a signed-in user. Private keys and service-role access stay on the server.

Schedule an authenticated `GET /api/cron/spending-alerts` every minute, sending `Authorization: Bearer <CRON_SECRET>`. Use your hosting scheduler, or [the supplied Supabase Cron schedule](../supabase/schedules/spending-alerts.sql). That schedule reads the URL and secret from Supabase Vault; configure the two Vault secrets named in the file before running it. Deploy the worker before enabling the schedule.

The worker evaluates month rollovers and newly due dates even when no dashboard is open, then claims up to 20 queued deliveries. Dashboard changes also request immediate delivery. Claims are leased for five minutes, transient failures retry with backoff up to five attempts, and expired subscriptions are removed. Monitor cron failures and exhausted deliveries (`sent_at is null and attempts >= 5`). Push delivery is at-least-once; stable notification tags collapse retries on the device. Delivery still depends on browser permissions, connectivity, and operating-system settings.

Users explicitly select **Enable on this device** and approve the browser prompt. This is never requested on page load. They can turn off a device independently or pause all spending alerts. Signing out unsubscribes the current device. Subscriptions have one account owner, so enabling a shared device for another account removes queued alerts for its previous owner. Push previews contain no amounts or account details; tapping one opens `/dashboard#spending-limit`. The service worker does not cache financial pages.

On iPhone/iPad, users may need to add Xtrack to their Home Screen before enabling notifications. The manifest and existing app icon support this flow. See the [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) and [Google's overview of push delivery](https://web.dev/articles/push-notifications-how-push-works).

## Verification

Run `npm run test:spending`, `npm run test:charts`, and `npm run build`. Spending tests run the actual migration in an isolated PostgreSQL engine (PGlite), checking threshold crossings, corrections, income changes, future dates, monthly deduplication, permissions, subscription ownership, and queue leases. They also check display calculations, request validation, and service-worker navigation. They never connect to the live database or send a real push.

After deployment, use a test account: set a fixed CAD 100 limit with an 80% warning, enable a device, record CAD 79.99 (no alert), then CAD 0.01 (warning), then CAD 20 (reached). Confirm the bell updates, each alert arrives once, and the device notification opens the spending card. With the app closed, a recorded transaction from another device should be delivered by the scheduled worker. Confirm pausing, denied permissions, sign-out, and another account on the same device as well.
