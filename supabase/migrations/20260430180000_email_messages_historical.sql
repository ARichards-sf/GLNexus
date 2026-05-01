-- `is_historical` flags email_messages rows that came from a one-shot
-- rescan (e.g. when a new prospect/contact is added and we backfill mail
-- they've sent the advisor). Historical mail is stored for context and
-- timeline display, but skipped by the AI prioritizer — there's no
-- meaningful "what should I act on right now?" answer for an email that
-- arrived months ago and has likely already been replied to.

alter table public.email_messages
  add column if not exists is_historical boolean not null default false;

-- The prioritizer scans `inbox` rows where contact_id is set and
-- ai_processed_at is null. Adding is_historical to the partial index so
-- the new filter (`is_historical = false`) hits the index too.
create index if not exists email_messages_pending_ai_idx
  on public.email_messages (advisor_id, received_at)
  where folder = 'inbox'
    and contact_id is not null
    and ai_processed_at is null
    and is_historical = false;
