-- =========================================================================
-- TEST DATA SEED — recent AUM drops to exercise the scorecard
-- =========================================================================
--
-- The scorecard at src/pages/Scorecard.tsx flags households whose most
-- recent household_snapshot is lower than the oldest snapshot within the
-- past 7 days, classified by getAlertLevel() at lines 92–115:
--
--   Large (>= $1M):    critical >= $500k or 15%, warning >= $100k or 8%, info >= $50k or 4%
--   Medium ($250k-1M): critical >= $100k or 12%, warning >= $25k or 7%, info >= $10k or 3%
--   Small (< $250k):   critical >= $25k or 10%,  warning >= $10k or 6%, info >= $3k or 3%
--
-- This script overrides the most recent 2 days of household_snapshots
-- (and the underlying account_snapshots) for 4 specific households to
-- create one alert at each tier. Idempotent — uses fixed multipliers, so
-- re-running converges on the same target values.
--
-- ASSUMES: scripts/seed_snapshots.sql has already been run successfully.
--
-- HOW TO USE:
--   1. Paste your advisor user_id below.
--   2. Run in Supabase Dashboard → SQL Editor.
-- =========================================================================

do $$
declare
  -- ── EDIT THIS LINE ─────────────────────────────────────────────────────
  v_advisor_id uuid := '2f069cbb-f634-4279-8946-123a33faa9c2';
  -- ───────────────────────────────────────────────────────────────────────

  -- (household_name, drop_multiplier_for_recent_2_days, expected_alert_level)
  -- Using multipliers vs. the household's already-snapshotted value rather
  -- than absolute deltas, so the math holds regardless of seed_snapshots
  -- exact values.
  drops constant jsonb := '[
    {"name": "The Castellanos Holdings", "mult": 0.82, "level": "critical"},
    {"name": "The Liu Family",           "mult": 0.88, "level": "warning"},
    {"name": "The Bennett Family",       "mult": 0.92, "level": "warning"},
    {"name": "The Vasquez Family",       "mult": 0.955, "level": "info"}
  ]'::jsonb;

  drop_spec jsonb;
  v_hh_id uuid;
  v_mult numeric;
  v_name text;
begin
  for drop_spec in select * from jsonb_array_elements(drops)
  loop
    v_name := drop_spec->>'name';
    v_mult := (drop_spec->>'mult')::numeric;

    select id into v_hh_id
    from public.households
    where advisor_id = v_advisor_id and name = v_name;

    if v_hh_id is null then
      raise warning 'Household "%" not found for advisor %, skipping', v_name, v_advisor_id;
      continue;
    end if;

    -- Knock down the household snapshot for yesterday and the day before.
    -- The scorecard's 7-day window includes both the unchanged earlier days
    -- and these two reduced days, triggering the alert.
    update public.household_snapshots
    set total_aum = round((total_aum * v_mult)::numeric, 2)
    where household_id = v_hh_id
      and advisor_id = v_advisor_id
      and snapshot_date >= current_date - 2
      and snapshot_date <= current_date - 1;

    -- Mirror the drop in the account_snapshots so household profile charts
    -- stay consistent with the rolled-up view.
    update public.account_snapshots asn
    set balance = round((asn.balance * v_mult)::numeric, 2)
    from public.contact_accounts ca
    join public.household_members hm on hm.id = ca.member_id
    where asn.account_id = ca.id
      and hm.household_id = v_hh_id
      and asn.advisor_id = v_advisor_id
      and asn.snapshot_date >= current_date - 2
      and asn.snapshot_date <= current_date - 1;

    raise notice 'Applied % multiplier to last 2 days for "%" (target alert: %)',
      v_mult, v_name, drop_spec->>'level';
  end loop;

  -- Recompute daily_snapshots so the advisor-level total stays consistent.
  update public.daily_snapshots ds
  set total_aum = sub.new_total
  from (
    select snapshot_date, sum(total_aum) as new_total
    from public.household_snapshots
    where advisor_id = v_advisor_id
      and snapshot_date >= current_date - 2
      and snapshot_date <= current_date - 1
    group by snapshot_date
  ) sub
  where ds.advisor_id = v_advisor_id
    and ds.snapshot_date = sub.snapshot_date;

  raise notice 'AUM drop seeding complete. Refresh the Scorecard to see the alerts.';
end $$;

-- =========================================================================
-- VERIFY
--
-- Show the configured drops and which alert level each would trigger:
--
--   with windowed as (
--     select hh.name, hh.id,
--       (select total_aum from household_snapshots
--          where household_id = hh.id and snapshot_date = current_date - 1) as current_aum,
--       (select total_aum from household_snapshots
--          where household_id = hh.id and snapshot_date = current_date - 7) as week_ago_aum
--     from households hh
--     where hh.advisor_id = '<your_advisor_id>'
--       and hh.name in ('The Castellanos Holdings','The Liu Family','The Bennett Family','The Vasquez Family')
--   )
--   select name,
--          to_char(current_aum,    '$FM999G999G999D00') as current_aum,
--          to_char(week_ago_aum,   '$FM999G999G999D00') as week_ago_aum,
--          to_char(week_ago_aum - current_aum, '$FM999G999G999D00') as dollar_drop,
--          round(((week_ago_aum - current_aum) / week_ago_aum * 100)::numeric, 1) || '%' as percent_drop
--   from windowed
--   order by week_ago_aum - current_aum desc;
-- =========================================================================
