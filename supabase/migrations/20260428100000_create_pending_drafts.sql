-- AI Inbox staging table. The `generate-pending-drafts` edge function scans
-- an advisor's trigger conditions (annual reviews due, AUM drops, overdue
-- touchpoints, stalled prospects) and writes pre-drafted outreach messages
-- here. The advisor reviews/edits/sends from the right-sidebar AI Inbox;
-- sending updates `status` and logs a real compliance note via the existing
-- send path.

create table if not exists public.pending_drafts (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null,
  household_id uuid references public.households(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  -- Trigger metadata — drives the badge/icon on the inbox row and is the
  -- key the edge function uses to dedupe (combined with household/prospect).
  trigger_reason text not null check (trigger_reason in (
    'annual_review_due',
    'aum_drop',
    'overdue_touchpoint',
    'stalled_prospect'
  )),
  trigger_context text,                   -- human-readable: "AUM down $250k over 30d"
  -- Content
  kind text not null check (kind in ('email', 'text')),
  subject text,                           -- null for SMS
  body text not null,
  -- Recipient — denormalized so the inbox row can show "To: Sarah Anderson"
  -- without a join. recipient_contact_id is the canonical pointer for the
  -- compliance-note junction when the draft is sent.
  recipient_contact_id uuid references public.household_members(id) on delete set null,
  recipient_name text not null,
  recipient_email text,
  recipient_phone text,
  -- Lifecycle. `pending` = visible in inbox; `sent` = moved to compliance
  -- notes; `dismissed` = advisor closed the row without sending.
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed')),
  -- Dedupe key: combination like "annual_review_due:hh-uuid" so the edge
  -- function can skip generating a duplicate draft on a re-run.
  source_key text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  dismissed_at timestamptz,
  -- Sanity: every row must point at *something*.
  constraint pending_drafts_target_check
    check (household_id is not null or prospect_id is not null)
);

create index if not exists pending_drafts_advisor_status_idx
  on public.pending_drafts (advisor_id, status, created_at desc);

create index if not exists pending_drafts_source_key_idx
  on public.pending_drafts (advisor_id, source_key, status);

-- RLS: advisor sees and mutates only their own drafts.
alter table public.pending_drafts enable row level security;

create policy "advisors_select_own_drafts"
  on public.pending_drafts for select
  using (advisor_id = auth.uid());

create policy "advisors_insert_own_drafts"
  on public.pending_drafts for insert
  with check (advisor_id = auth.uid());

create policy "advisors_update_own_drafts"
  on public.pending_drafts for update
  using (advisor_id = auth.uid());

create policy "advisors_delete_own_drafts"
  on public.pending_drafts for delete
  using (advisor_id = auth.uid());
