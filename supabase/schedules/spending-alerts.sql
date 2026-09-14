-- Optional Supabase-hosted scheduler. Apply AFTER the migration and deployment.
-- In Supabase Vault, create these secrets using the Dashboard:
--   xtrack_spending_worker_url = https://YOUR-DEPLOYMENT/api/cron/spending-alerts
--   xtrack_spending_cron_secret = the exact CRON_SECRET set on your deployment
-- Never paste real secrets into this version-controlled file.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Fail clearly instead of scheduling a job with missing credentials.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'xtrack_spending_worker_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'xtrack_spending_cron_secret') then
    raise exception 'Create the two xtrack spending worker secrets in Vault first.';
  end if;
end;
$$;

select cron.schedule('xtrack-spending-alerts', '* * * * *', $job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'xtrack_spending_worker_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'xtrack_spending_cron_secret')),
    timeout_milliseconds := 55000
  );
$job$);
