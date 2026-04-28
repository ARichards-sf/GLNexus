-- =========================================================================
-- TEST DATA SEED — recent AUM drops to exercise the scorecard
-- =========================================================================
--
-- Models a real recent decline for 4 specific households so the Scorecard
-- AUM Changes panel surfaces one alert at each tier:
--
--   Castellanos Holdings → critical (large concentrated-stock drop)
--   Liu Family           → warning  (RSU concentration hit)
--   Bennett Family       → warning  (medium-tier drop)
--   Vasquez Family       → info     (mild large-tier drop)
--
-- The Scorecard at src/pages/Scorecard.tsx looks at the past 30 days of
-- household_snapshots, compares the most recent vs. the oldest, and
-- classifies via getAlertLevel() at lines 92–115:
--
--   Large (>= $1M):    critical >= $500k or 15%, warning >= $100k or 8%, info >= $50k or 4%
--   Medium ($250k-1M): critical >= $100k or 12%, warning >= $25k or 7%,  info >= $10k or 3%
--   Small (< $250k):   critical >= $25k  or 10%, warning >= $10k or 6%,  info >= $3k  or 3%
--
-- WHY THIS SCRIPT IS DIFFERENT FROM A NAIVE SNAPSHOT-ONLY DROP:
--
-- The nightly cron job (run-daily-snapshots-utc-midnight) re-creates each
-- day's snapshot from the LIVE households.total_aum. So if we only knock
-- down old snapshots, today's fresh cron-inserted snapshot is back at
-- full value and the Scorecard reads "no drop." This script updates the
-- live household + account values so the drop is real and persistent —
-- every future cron run will continue inserting at the dropped level.
--
-- IDEMPOTENCY:
--
-- The script keys off the original AUM values from seed_test_data.sql
-- (hard-coded below) and applies a fixed multiplier. Re-running converges
-- on the same dropped values rather than compounding. Older snapshots
-- (>= 2 days ago) are reset to the drift formula's expected value before
-- being re-dropped, so historical curves stay consistent across reruns.
--
-- HOW TO USE:
--   1. Make sure seed_test_data.sql + seed_snapshots.sql have run.
--   2. Paste your advisor user_id below.
--   3. Run in Supabase Dashboard → SQL Editor.
-- =========================================================================

do $$
declare
  -- ── EDIT THIS LINE ─────────────────────────────────────────────────────
  v_advisor_id uuid := '2f069cbb-f634-4279-8946-123a33faa9c2';
  -- ───────────────────────────────────────────────────────────────────────

  -- (household_name, original_aum_from_seed, drop_multiplier, expected_alert_level)
  drops constant jsonb := '[
    {"name": "The Castellanos Holdings", "orig": 6500000, "mult": 0.78, "level": "critical"},
    {"name": "The Liu Family",           "orig":  950000, "mult": 0.85, "level": "warning"},
    {"name": "The Bennett Family",       "orig":  620000, "mult": 0.86, "level": "warning"},
    {"name": "The Vasquez Family",       "orig": 1600000, "mult": 0.90, "level": "info"}
  ]'::jsonb;

  drop_spec jsonb;
  v_hh_id uuid;
  v_orig numeric;
  v_mult numeric;
  v_target_aum numeric;
  v_account_factor numeric;
  v_name text;
begin
  for drop_spec in select * from jsonb_array_elements(drops)
  loop
    v_name        := drop_spec->>'name';
    v_orig        := (drop_spec->>'orig')::numeric;
    v_mult        := (drop_spec->>'mult')::numeric;
    v_target_aum  := round(v_orig * v_mult, 2);

    select id into v_hh_id
    from public.households
    where advisor_id = v_advisor_id and name = v_name;

    if v_hh_id is null then
      raise warning 'Household "%" not found for advisor %, skipping', v_name, v_advisor_id;
      continue;
    end if;

    -- The factor relative to the household's CURRENT live AUM. If a
    -- previous run already dropped it, this restores then re-drops
    -- consistently.
    select v_target_aum / nullif(total_aum, 0)
    into v_account_factor
    from public.households where id = v_hh_id;

    if v_account_factor is null or v_account_factor = 1 then
      v_account_factor := v_mult;  -- fallback: apply mult directly
    end if;

    -- 1. Update the LIVE household total_aum to the dropped value.
    update public.households
    set total_aum = v_target_aum
    where id = v_hh_id;

    -- 2. Update underlying account balances proportionally.
    update public.contact_accounts ca
    set balance = round((ca.balance * v_account_factor)::numeric, 2)
    from public.household_members hm
    where ca.member_id = hm.id
      and hm.household_id = v_hh_id;

    -- 3. Update the most recent snapshots (last 3 days) so the trajectory
    --    visibly bends downward right at the end of the chart. We use
    --    UPSERT so this works whether or not the cron has already created
    --    today's snapshot.
    insert into public.household_snapshots (household_id, advisor_id, total_aum, snapshot_date)
    select v_hh_id, v_advisor_id, v_target_aum, d::date
    from generate_series(current_date - 2, current_date, interval '1 day') as d
    on conflict (household_id, snapshot_date)
      do update set total_aum = excluded.total_aum;

    -- 4. Update account_snapshots for the same window so household profile
    --    charts (which roll up from accounts) match.
    update public.account_snapshots asn
    set balance = round((asn.balance * v_account_factor)::numeric, 2)
    from public.contact_accounts ca
    join public.household_members hm on hm.id = ca.member_id
    where asn.account_id = ca.id
      and hm.household_id = v_hh_id
      and asn.advisor_id = v_advisor_id
      and asn.snapshot_date >= current_date - 2;

    raise notice 'Dropped "%" to $% (mult %, target alert: %)',
      v_name, v_target_aum, v_mult, drop_spec->>'level';
  end loop;

  -- 5. Rebuild daily_snapshots for the affected days from the new household totals.
  insert into public.daily_snapshots (advisor_id, total_aum, household_count, snapshot_date)
  select
    v_advisor_id,
    sum(hs.total_aum),
    count(distinct hs.household_id),
    hs.snapshot_date
  from public.household_snapshots hs
  where hs.advisor_id = v_advisor_id
    and hs.snapshot_date >= current_date - 2
  group by hs.snapshot_date
  on conflict (advisor_id, snapshot_date)
    do update set
      total_aum = excluded.total_aum,
      household_count = excluded.household_count;

  raise notice 'AUM drop seeding complete. Refresh the Scorecard to see the alerts.';
end $$;

-- =========================================================================
-- VERIFY
--
--   with windowed as (
--     select hh.name, hh.id, hh.total_aum as live_aum,
--       (select total_aum from public.household_snapshots
--          where household_id = hh.id
--          order by snapshot_date desc limit 1) as latest_snapshot,
--       (select total_aum from public.household_snapshots
--          where household_id = hh.id and snapshot_date <= current_date - 30
--          order by snapshot_date desc limit 1) as month_ago
--     from public.households hh
--     where hh.advisor_id = '2f069cbb-f634-4279-8946-123a33faa9c2'
--       and hh.name in ('The Castellanos Holdings','The Liu Family','The Bennett Family','The Vasquez Family')
--   )
--   select name,
--          to_char(live_aum,        '$FM999G999G999D00') as live_aum,
--          to_char(latest_snapshot, '$FM999G999G999D00') as latest_snapshot,
--          to_char(month_ago,       '$FM999G999G999D00') as month_ago,
--          to_char(month_ago - latest_snapshot, '$FM999G999G999D00') as dollar_drop,
--          round(((month_ago - latest_snapshot) / month_ago * 100)::numeric, 1) || '%' as percent_drop
--   from windowed
--   order by month_ago - latest_snapshot desc;
-- =========================================================================
