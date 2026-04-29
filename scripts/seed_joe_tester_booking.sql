-- Seed Joe Tester (92de3c6a-786a-460d-8704-94f7228be169) with a working
-- public booking page so the AI emails generated for his book have a real
-- /book/joe-tester URL to point at.
--
-- Idempotent: deletes existing rows first so re-running cleanly resets the
-- demo configuration.

do $$
declare
  joe_id uuid := '92de3c6a-786a-460d-8704-94f7228be169';
begin
  delete from public.booking_meeting_types where advisor_id = joe_id;
  delete from public.advisor_availability_windows where advisor_id = joe_id;
  delete from public.advisor_booking_settings where advisor_id = joe_id;

  insert into public.advisor_booking_settings (
    advisor_id, slug, title, intro,
    time_zone, advance_notice_hours, buffer_minutes, max_per_day, date_range_days, enabled
  ) values (
    joe_id,
    'joe-tester',
    'Book a meeting with Joe Tester',
    'Pick a time that works for you. I block out time on my calendar for client conversations Monday through Friday — happy to make it work around your schedule.',
    'America/Los_Angeles',
    24,
    15,
    8,
    60,
    true
  );

  -- Standard work week: Mon–Fri 9am–5pm Pacific.
  insert into public.advisor_availability_windows (advisor_id, day_of_week, start_time, end_time)
  values
    (joe_id, 1, '09:00', '17:00'),
    (joe_id, 2, '09:00', '17:00'),
    (joe_id, 3, '09:00', '17:00'),
    (joe_id, 4, '09:00', '17:00'),
    (joe_id, 5, '09:00', '17:00');

  insert into public.booking_meeting_types (
    advisor_id, slug, name, description,
    duration_minutes, event_type, pre_meeting_question, color, active, sort_order
  ) values
    (
      joe_id,
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
      joe_id,
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
      joe_id,
      'check-in',
      'Quick Check-in',
      'A 15-minute call for a focused question or update.',
      15,
      'Discovery Call',
      'What''s on your mind?',
      '#10b981',
      true,
      2
    );
end $$;

-- Verify
select
  s.slug,
  s.title,
  (select count(*) from public.advisor_availability_windows w where w.advisor_id = s.advisor_id) as availability_windows,
  (select count(*) from public.booking_meeting_types t where t.advisor_id = s.advisor_id) as meeting_types
from public.advisor_booking_settings s
where s.advisor_id = '92de3c6a-786a-460d-8704-94f7228be169';
