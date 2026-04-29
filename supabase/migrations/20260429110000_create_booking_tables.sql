-- Calendly-style booking infrastructure (v1).
--
-- Three tables:
--   1. advisor_booking_settings — 1:1 with advisor; the public-facing
--      booking page configuration (slug, intro, defaults).
--   2. advisor_availability_windows — recurring weekly availability windows
--      (e.g. Mon 09:00–17:00). The slot calculator unions these with
--      existing calendar_events to produce bookable slots.
--   3. booking_meeting_types — the meeting types the advisor offers
--      publicly (Discovery Call 30 min, Annual Review 60 min, etc.).
--
-- Public read access is intentional: the booking page must work for
-- unauthenticated visitors. Booking writes go through an edge function
-- using the service role.

-- ============================================================
-- advisor_booking_settings
-- ============================================================
create table if not exists public.advisor_booking_settings (
  advisor_id uuid primary key,
  slug text not null unique,
  title text not null default 'Book a meeting',
  intro text,
  -- IANA tz, e.g. "America/Los_Angeles". The advisor's local time zone
  -- is the source of truth for availability windows; clients see slots
  -- rendered in their own browser tz.
  time_zone text not null default 'America/Los_Angeles',
  advance_notice_hours int not null default 24,
  buffer_minutes int not null default 15,
  max_per_day int not null default 8,
  date_range_days int not null default 60,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$')
);

create index if not exists advisor_booking_settings_slug_idx
  on public.advisor_booking_settings (slug);

alter table public.advisor_booking_settings enable row level security;

-- Public can read enabled settings — that's how the /book/:slug page works
-- without auth. Disabled rows stay invisible to anonymous visitors.
create policy "public_read_enabled_settings"
  on public.advisor_booking_settings for select
  to anon, authenticated
  using (enabled = true);

-- Advisors manage their own row.
create policy "advisor_manage_own_settings"
  on public.advisor_booking_settings for all
  to authenticated
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());

-- ============================================================
-- advisor_availability_windows
-- ============================================================
create table if not exists public.advisor_availability_windows (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null,
  -- 0 = Sunday, 6 = Saturday (matches JS Date.getDay()).
  day_of_week smallint not null check (day_of_week between 0 and 6),
  -- Stored as text in HH:MM 24-hour format, interpreted in the advisor's
  -- configured time_zone. Using text keeps DST handling simple — we let
  -- the client compute UTC slots from these strings + the advisor tz.
  start_time text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  created_at timestamptz not null default now()
);

create index if not exists availability_advisor_idx
  on public.advisor_availability_windows (advisor_id, day_of_week);

alter table public.advisor_availability_windows enable row level security;

create policy "public_read_availability"
  on public.advisor_availability_windows for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.advisor_booking_settings s
      where s.advisor_id = advisor_availability_windows.advisor_id
        and s.enabled = true
    )
  );

create policy "advisor_manage_own_availability"
  on public.advisor_availability_windows for all
  to authenticated
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());

-- ============================================================
-- booking_meeting_types
-- ============================================================
create table if not exists public.booking_meeting_types (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null,
  slug text not null,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes between 5 and 480),
  -- Maps to existing EVENT_TYPES so created calendar_events match the
  -- advisor's normal scheduling model (Annual Review, Discovery Call,
  -- Portfolio Update, Prospecting).
  event_type text not null,
  pre_meeting_question text,
  color text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint type_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$'),
  unique (advisor_id, slug)
);

create index if not exists booking_meeting_types_advisor_active_idx
  on public.booking_meeting_types (advisor_id, active, sort_order);

alter table public.booking_meeting_types enable row level security;

create policy "public_read_active_types"
  on public.booking_meeting_types for select
  to anon, authenticated
  using (
    active = true
    and exists (
      select 1 from public.advisor_booking_settings s
      where s.advisor_id = booking_meeting_types.advisor_id
        and s.enabled = true
    )
  );

create policy "advisor_manage_own_types"
  on public.booking_meeting_types for all
  to authenticated
  using (advisor_id = auth.uid())
  with check (advisor_id = auth.uid());
