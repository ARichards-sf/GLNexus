-- Create + seed touchpoint_templates per wealth tier so the household
-- "Generate Client Experience" dialog has a real menu to draw from.
-- Without rows in this table the dialog only emits auto-birthdays from
-- member DOBs, which is what was happening post-Lovable migration.
--
-- Table schema mirrors the Lovable-era one (matches src/integrations/
-- supabase/types.ts). The CREATE is `if not exists` so re-applying is
-- safe. Inserts are gated by per-tier emptiness checks below.
--
-- Cadence philosophy:
--   silver   = annual review + 4 quarterly market updates + holiday card
--              (~6 templates, light touch)
--   gold     = silver baseline + mid-year check-in call + appreciation
--              call + year-end tax letter (~9 templates)
--   platinum = gold baseline + quarterly review meetings + premium
--              holiday gift + annual appreciation event (~13 templates)
--
-- Birthdays are NOT seeded here — TouchpointGenerationDialog generates
-- those automatically from household_members.date_of_birth.

-- ============================================================
-- Table + RLS
-- ============================================================
create table if not exists public.touchpoint_templates (
  id uuid primary key default gen_random_uuid(),
  tier text not null,
  name text not null,
  touchpoint_type text not null,
  scheduling_type text not null default 'fixed_month',
  fixed_month smallint check (fixed_month is null or fixed_month between 1 and 12),
  fixed_day smallint check (fixed_day is null or fixed_day between 1 and 31),
  month_offset smallint,
  description text,
  is_billable boolean default false,
  created_at timestamptz default now()
);

create index if not exists touchpoint_templates_tier_idx
  on public.touchpoint_templates (tier);

alter table public.touchpoint_templates enable row level security;

-- All authenticated users can read the catalog. Write paths are intentionally
-- not exposed via RLS — templates are seeded/managed via migrations or
-- service-role admin tooling.
drop policy if exists "authenticated_read_touchpoint_templates" on public.touchpoint_templates;
create policy "authenticated_read_touchpoint_templates"
  on public.touchpoint_templates for select
  to authenticated
  using (true);

-- ============================================================
-- Seed
-- ============================================================
do $$
begin
  -- ============================================================
  -- SILVER (~6 templates)
  -- ============================================================
  if not exists (select 1 from public.touchpoint_templates where tier = 'silver') then
    insert into public.touchpoint_templates
      (tier, name, touchpoint_type, scheduling_type, fixed_month, fixed_day, description, is_billable)
    values
      ('silver', 'Annual Review',           'annual_review',     'fixed_month', 3,  15, 'Yearly portfolio + planning review meeting.', false),
      ('silver', 'Q1 Market Update',        'market_assessment', 'fixed_month', 1,  15, 'Quarterly market commentary newsletter.',     false),
      ('silver', 'Q2 Market Update',        'market_assessment', 'fixed_month', 4,  15, 'Quarterly market commentary newsletter.',     false),
      ('silver', 'Q3 Market Update',        'market_assessment', 'fixed_month', 7,  15, 'Quarterly market commentary newsletter.',     false),
      ('silver', 'Q4 Market Update',        'market_assessment', 'fixed_month', 10, 15, 'Quarterly market commentary newsletter.',     false),
      ('silver', 'Holiday Card',            'holiday',           'fixed_month', 12, 1,  'Year-end holiday card.',                       false);
  end if;

  -- ============================================================
  -- GOLD (silver baseline + 3 extras = ~9 templates)
  -- ============================================================
  if not exists (select 1 from public.touchpoint_templates where tier = 'gold') then
    insert into public.touchpoint_templates
      (tier, name, touchpoint_type, scheduling_type, fixed_month, fixed_day, description, is_billable)
    values
      ('gold', 'Annual Review',             'annual_review',     'fixed_month', 3,  15, 'Yearly portfolio + planning review meeting.',           false),
      ('gold', 'Mid-Year Check-In Call',    'call',              'fixed_month', 8,  15, 'Mid-year status call to review progress and changes.',  false),
      ('gold', 'Q1 Market Update',          'market_assessment', 'fixed_month', 1,  15, 'Quarterly market commentary newsletter.',               false),
      ('gold', 'Q2 Market Update',          'market_assessment', 'fixed_month', 4,  15, 'Quarterly market commentary newsletter.',               false),
      ('gold', 'Q3 Market Update',          'market_assessment', 'fixed_month', 7,  15, 'Quarterly market commentary newsletter.',               false),
      ('gold', 'Q4 Market Update',          'market_assessment', 'fixed_month', 10, 15, 'Quarterly market commentary newsletter.',               false),
      ('gold', 'Spring Appreciation Call',  'call',              'fixed_month', 5,  15, 'Casual relationship-building call. No agenda.',         false),
      ('gold', 'Year-End Tax Letter',       'letter',            'fixed_month', 11, 15, 'Tax-loss harvesting + year-end planning summary.',      false),
      ('gold', 'Holiday Card',              'holiday',           'fixed_month', 12, 1,  'Year-end holiday card.',                                false);
  end if;

  -- ============================================================
  -- PLATINUM (gold baseline + 4 extras = ~13 templates)
  -- ============================================================
  if not exists (select 1 from public.touchpoint_templates where tier = 'platinum') then
    insert into public.touchpoint_templates
      (tier, name, touchpoint_type, scheduling_type, fixed_month, fixed_day, description, is_billable)
    values
      ('platinum', 'Q1 Annual Review',         'annual_review',     'fixed_month', 3,  15, 'Comprehensive yearly review meeting.',                  false),
      ('platinum', 'Q2 Portfolio Review',      'meeting',           'fixed_month', 6,  15, 'Quarterly portfolio review meeting.',                   false),
      ('platinum', 'Q3 Portfolio Review',      'meeting',           'fixed_month', 9,  15, 'Quarterly portfolio review meeting.',                   false),
      ('platinum', 'Q4 Portfolio Review',      'meeting',           'fixed_month', 12, 5,  'Quarterly portfolio review + year-end planning.',       false),
      ('platinum', 'Q1 Market Update',         'market_assessment', 'fixed_month', 1,  15, 'Quarterly market commentary newsletter.',               false),
      ('platinum', 'Q2 Market Update',         'market_assessment', 'fixed_month', 4,  15, 'Quarterly market commentary newsletter.',               false),
      ('platinum', 'Q3 Market Update',         'market_assessment', 'fixed_month', 7,  15, 'Quarterly market commentary newsletter.',               false),
      ('platinum', 'Q4 Market Update',         'market_assessment', 'fixed_month', 10, 15, 'Quarterly market commentary newsletter.',               false),
      ('platinum', 'Mid-Year Touch Call',      'call',              'fixed_month', 7,  15, 'Mid-year personal check-in call.',                       false),
      ('platinum', 'Year-End Tax Letter',      'letter',            'fixed_month', 11, 15, 'Tax-loss harvesting + year-end planning summary.',       false),
      ('platinum', 'Annual Appreciation Event','appreciation_event','fixed_month', 10, 15, 'Premium client appreciation event invitation.',          false),
      ('platinum', 'Premium Holiday Gift',     'premium_card',      'fixed_month', 12, 1,  'Premium holiday gift + handwritten note.',               false),
      ('platinum', 'Spring Check-In Letter',   'letter',            'fixed_month', 5,  15, 'Personalized spring update letter.',                     false);
  end if;
end $$;
