-- Outlook integration: stores per-advisor Microsoft Graph connection state
-- (refresh tokens, delta cursors) and the synced email corpus that the AI
-- prioritizer reads + writes back classifications onto.
--
-- POC NOTE: refresh_token / access_token are stored in plaintext columns
-- guarded only by RLS. Before this ships to production with multiple
-- advisors, move tokens behind Supabase Vault (or KMS) and replace these
-- columns with opaque references.

-- ---------------------------------------------------------------------------
-- 1. OAuth state — short-lived nonce used to tie an authorize redirect back
--    to the advisor who initiated it. Rows are created by outlook-oauth-start
--    and consumed (deleted) by outlook-oauth-callback. Service-role only —
--    no RLS policies means PostgREST clients can't see these rows.
-- ---------------------------------------------------------------------------
create table if not exists public.outlook_oauth_states (
  state uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index if not exists outlook_oauth_states_advisor_idx
  on public.outlook_oauth_states(advisor_id);

create index if not exists outlook_oauth_states_expires_idx
  on public.outlook_oauth_states(expires_at);

alter table public.outlook_oauth_states enable row level security;
-- intentionally no policies: locked to service role

-- ---------------------------------------------------------------------------
-- 2. Connection — one row per advisor who has linked their Outlook mailbox.
--    Holds the refresh token plus a delta cursor for Inbox and Sent so each
--    sync only pulls new/changed messages.
-- ---------------------------------------------------------------------------
create table if not exists public.outlook_connections (
  advisor_id uuid primary key references auth.users(id) on delete cascade,
  microsoft_user_id text not null,
  email text not null,
  display_name text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  inbox_delta_link text,
  sent_delta_link text,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.outlook_connections enable row level security;

-- Advisor can see their own connection (UI shows "Connected as foo@bar.com")
-- and can disconnect (delete) it. All token writes happen via service role
-- inside the edge functions.
create policy "advisor_reads_own_connection"
  on public.outlook_connections for select
  using (advisor_id = auth.uid());

create policy "advisor_disconnects_own"
  on public.outlook_connections for delete
  using (advisor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Email messages — synced Graph messages plus the AI prioritizer's output.
--    Linked back to household_members / households / prospects when the
--    sender or recipient matches an existing CRM record.
-- ---------------------------------------------------------------------------
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  graph_message_id text not null,
  graph_conversation_id text,
  folder text not null check (folder in ('inbox', 'sent')),
  -- Sender
  from_email text,
  from_name text,
  -- Recipients: jsonb arrays of {email, name}
  to_recipients jsonb not null default '[]'::jsonb,
  cc_recipients jsonb not null default '[]'::jsonb,
  -- Content
  subject text,
  body_preview text,
  body_html text,
  -- Graph metadata
  received_at timestamptz,
  sent_at timestamptz,
  importance text,
  has_attachments boolean not null default false,
  is_read boolean not null default false,
  web_link text,
  -- CRM linkage (any may be null — e.g. sender not in book)
  contact_id uuid references public.household_members(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  -- AI prioritization output. ai_processed_at is null for messages the
  -- prioritizer hasn't seen yet — used to drive the work queue.
  ai_priority text check (ai_priority in ('low', 'normal', 'high', 'urgent')),
  ai_priority_score smallint,
  ai_summary text,
  ai_intent text,
  ai_suggested_action text,
  ai_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (advisor_id, graph_message_id)
);

create index if not exists email_messages_advisor_folder_idx
  on public.email_messages(advisor_id, folder, received_at desc);

create index if not exists email_messages_contact_idx
  on public.email_messages(advisor_id, contact_id, received_at desc)
  where contact_id is not null;

create index if not exists email_messages_household_idx
  on public.email_messages(advisor_id, household_id, received_at desc)
  where household_id is not null;

create index if not exists email_messages_unprocessed_idx
  on public.email_messages(advisor_id, ai_processed_at)
  where ai_processed_at is null;

create index if not exists email_messages_priority_idx
  on public.email_messages(advisor_id, ai_priority, received_at desc)
  where ai_priority in ('high', 'urgent');

alter table public.email_messages enable row level security;

create policy "advisor_reads_own_emails"
  on public.email_messages for select
  using (advisor_id = auth.uid());

create policy "advisor_updates_own_emails"
  on public.email_messages for update
  using (advisor_id = auth.uid());
-- Inserts only via service role inside outlook-sync.

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists outlook_connections_set_updated_at
  on public.outlook_connections;
create trigger outlook_connections_set_updated_at
  before update on public.outlook_connections
  for each row execute function public.set_updated_at();

drop trigger if exists email_messages_set_updated_at
  on public.email_messages;
create trigger email_messages_set_updated_at
  before update on public.email_messages
  for each row execute function public.set_updated_at();
