-- Seed every advisor with booking enabled with the three standard meeting
-- types: Discovery Call (30 min), Annual Review (60 min), Quick Check-in
-- (15 min). Insert is idempotent — uses ON CONFLICT (advisor_id, slug) so
-- re-running this migration won't duplicate rows for advisors who already
-- have the slugs.
--
-- Also installs a trigger on advisor_booking_settings that auto-seeds the
-- same three types for any future advisor that creates a booking page.
-- Existing rows are unaffected by the trigger; the INSERT below handles the
-- backfill.

-- ============================================================
-- Backfill: existing advisors
-- ============================================================
do $$
declare
  rec record;
begin
  for rec in
    select advisor_id from public.advisor_booking_settings
  loop
    insert into public.booking_meeting_types
      (advisor_id, slug, name, description, duration_minutes, event_type, pre_meeting_question, color, active, sort_order)
    values
      (
        rec.advisor_id,
        'discovery-call',
        'Discovery Call',
        'A 30-minute introductory conversation to understand your situation and goals. No prep needed — come as you are.',
        30,
        'Discovery Call',
        'What''s the most important thing you''d like to walk away from this conversation with?',
        '#3b82f6',
        true,
        0
      ),
      (
        rec.advisor_id,
        'annual-review',
        'Annual Review',
        'A 60-minute deep-dive on your portfolio, financial plan progress, and any life changes that should be reflected in our strategy.',
        60,
        'Annual Review',
        'Anything specific you''d like to make sure we cover?',
        '#a855f7',
        true,
        1
      ),
      (
        rec.advisor_id,
        'check-in',
        'Quick Check-in',
        'A 15-minute call for a focused question or update.',
        15,
        'Discovery Call',
        'What''s on your mind?',
        '#10b981',
        true,
        2
      )
    on conflict (advisor_id, slug) do nothing;
  end loop;
end $$;

-- ============================================================
-- Trigger: auto-seed for new advisors
-- ============================================================
create or replace function public.seed_default_meeting_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.booking_meeting_types
    (advisor_id, slug, name, description, duration_minutes, event_type, pre_meeting_question, color, active, sort_order)
  values
    (
      new.advisor_id,
      'discovery-call',
      'Discovery Call',
      'A 30-minute introductory conversation to understand your situation and goals. No prep needed — come as you are.',
      30,
      'Discovery Call',
      'What''s the most important thing you''d like to walk away from this conversation with?',
      '#3b82f6',
      true,
      0
    ),
    (
      new.advisor_id,
      'annual-review',
      'Annual Review',
      'A 60-minute deep-dive on your portfolio, financial plan progress, and any life changes that should be reflected in our strategy.',
      60,
      'Annual Review',
      'Anything specific you''d like to make sure we cover?',
      '#a855f7',
      true,
      1
    ),
    (
      new.advisor_id,
      'check-in',
      'Quick Check-in',
      'A 15-minute call for a focused question or update.',
      15,
      'Discovery Call',
      'What''s on your mind?',
      '#10b981',
      true,
      2
    )
  on conflict (advisor_id, slug) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_default_meeting_types on public.advisor_booking_settings;
create trigger trg_seed_default_meeting_types
  after insert on public.advisor_booking_settings
  for each row
  execute function public.seed_default_meeting_types();
