-- Bump the seeded "Quick Check-in" meeting type from 15 to 30 minutes.
-- 15 was too short to be useful in practice. The duration + description
-- update only touches rows that still match the original seed (slug
-- 'check-in' with duration 15 and the seeded description), so any advisor
-- who customized their check-in length is left alone.

update public.booking_meeting_types
set
  duration_minutes = 30,
  description = 'A 30-minute call for a focused question or update.'
where slug = 'check-in'
  and duration_minutes = 15
  and description = 'A 15-minute call for a focused question or update.';

-- Replace the auto-seed trigger function so any future advisor that
-- creates a booking page gets the 30-minute default.
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
      'A 30-minute call for a focused question or update.',
      30,
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
