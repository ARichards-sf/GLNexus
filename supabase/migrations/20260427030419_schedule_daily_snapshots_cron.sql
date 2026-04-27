-- Schedule the nightly snapshot + tier-reassessment job.
--
-- Calls the `run-daily-snapshots` edge function over HTTP via pg_net every day
-- at 00:00 UTC. The function does both the SQL `generate_daily_snapshots()`
-- RPC and the annual tier reassessment that's implemented in TypeScript, so
-- scheduling the SQL function directly would not be sufficient.
--
-- pg_cron + pg_net extensions are enabled in 20260410191742; this migration
-- assumes both are available. The bearer token below is the project's public
-- anon key — not a secret. The edge function itself uses the service-role key
-- from its env to do privileged work, so the caller's auth doesn't need to be
-- privileged.
--
-- cron.schedule() with an existing jobname updates in place, so re-running this
-- migration is safe.

select cron.schedule(
  'run-daily-snapshots-utc-midnight',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://enndhfonpvgnethumklq.supabase.co/functions/v1/run-daily-snapshots',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubmRoZm9ucHZnbmV0aHVta2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNDI1MzEsImV4cCI6MjA5MjgxODUzMX0.IMrH37151UWb6LW8I4eivpOyA25nccvR8VoiecAB2o4'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
