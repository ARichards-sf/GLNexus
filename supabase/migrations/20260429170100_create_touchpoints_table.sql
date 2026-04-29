-- Create the touchpoints table.
--
-- This table is queried by TouchpointTimeline, Scorecard, and the
-- TouchpointGenerationDialog ("Generate Client Experience" on a household)
-- but it never had a create migration in this project — it was a Lovable-
-- era table that didn't carry over. Without it, the Generate Client
-- Experience dialog only emits auto-birthday entries (the rest fall
-- through to a missing relation).
--
-- Schema mirrors src/integrations/supabase/types.ts. RLS scopes rows to
-- the owning advisor.

create table if not exists public.touchpoints (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null,
  household_id uuid not null,
  template_id uuid,
  name text not null,
  touchpoint_type text not null,
  scheduled_date date not null,
  completed_date date,
  status text not null default 'upcoming',
  notes text,
  metadata jsonb,
  linked_event_id uuid,
  linked_task_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists touchpoints_advisor_idx on public.touchpoints (advisor_id);
create index if not exists touchpoints_household_idx on public.touchpoints (household_id);
create index if not exists touchpoints_status_idx on public.touchpoints (advisor_id, status);

alter table public.touchpoints enable row level security;

drop policy if exists "advisor_manage_own_touchpoints" on public.touchpoints;
create policy "advisor_manage_own_touchpoints"
  on public.touchpoints for all
  to authenticated
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());
