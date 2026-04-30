-- Adds sentiment classification to email_messages so the Priority Inbox can
-- surface frustrated / negative client mail above neutral correspondence.
-- Also schedules a 5-minute cron that fans out to all connected advisors.

alter table public.email_messages
  add column if not exists ai_sentiment text
    check (ai_sentiment in ('positive', 'neutral', 'negative', 'frustrated'));

create index if not exists email_messages_priority_sentiment_idx
  on public.email_messages(advisor_id, ai_priority, ai_sentiment, received_at desc)
  where ai_priority in ('high', 'urgent');

-- ---------------------------------------------------------------------------
-- Cron: every 5 minutes, hit outlook-sync with { all: true } so the function
-- iterates over every connected advisor and syncs each one. The bearer token
-- below is the project's public anon key (not a secret); the function uses
-- the service-role key from its own env to do privileged work.
-- cron.schedule() upserts by jobname, so re-running this migration is safe.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'outlook-sync-every-5-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://enndhfonpvgnethumklq.supabase.co/functions/v1/outlook-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubmRoZm9ucHZnbmV0aHVta2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNDI1MzEsImV4cCI6MjA5MjgxODUzMX0.IMrH37151UWb6LW8I4eivpOyA25nccvR8VoiecAB2o4'
    ),
    body := '{"all": true}'::jsonb
  ) as request_id;
  $$
);
