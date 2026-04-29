-- Activity stream for the right-sidebar copilot console. Captures the
-- automation moments the advisor would otherwise miss: drafts created,
-- meetings completed, prospects moved through pipeline, etc. Read by
-- ActivityStreamSection (top 10 most recent per advisor).

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null,
  -- `kind` is a coarse classifier that drives the row's icon and tone.
  -- Keep this list small; copy lives in `title` / `body`.
  kind text not null check (kind in (
    'draft_generated',
    'draft_sent',
    'draft_dismissed',
    'aum_drop_detected',
    'tier_changed',
    'pipeline_changed',
    'meeting_completed',
    'task_due_soon',
    'cooldown_ending',
    'system'
  )),
  title text not null,         -- "Drafted annual review email for Henderson"
  body text,                   -- optional second-line detail
  -- Targets (any may be null). Used to build the click-through link.
  household_id uuid references public.households(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  related_record_id uuid,
  related_record_type text,
  -- Read-state. Currently informational only; the section auto-marks read
  -- on view, but we keep the timestamp so future filters/badges can use it.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_advisor_recent_idx
  on public.activity_events (advisor_id, created_at desc);

create index if not exists activity_events_advisor_unread_idx
  on public.activity_events (advisor_id, read_at)
  where read_at is null;

alter table public.activity_events enable row level security;

create policy "advisors_select_own_activity"
  on public.activity_events for select
  using (advisor_id = auth.uid());

create policy "advisors_insert_own_activity"
  on public.activity_events for insert
  with check (advisor_id = auth.uid());

create policy "advisors_update_own_activity"
  on public.activity_events for update
  using (advisor_id = auth.uid());

create policy "advisors_delete_own_activity"
  on public.activity_events for delete
  using (advisor_id = auth.uid());
