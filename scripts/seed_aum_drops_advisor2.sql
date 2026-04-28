-- =========================================================================
-- TEST DATA SEED — recent AUM drops to exercise the scorecard
-- (advisor 2 — Beaumont/Yamamoto/Vance book)
-- =========================================================================
--
-- Mirrors scripts/seed_aum_drops.sql but scoped to advisor 2 and targets
-- four households from this book, one per scorecard alert tier:
--
--   Yamamoto Trust → critical (alternatives markdown + private fund hit)
--   Park-Lee Trust → warning  (pre-IPO valuation cut on Stratos shares)
--   Russo Family   → warning  (family-business valuation reset before sale)
--   Asante Family  → info     (mild large-tier drop)
--
-- Same mechanic as the original: updates LIVE households.total_aum so the
-- nightly cron continues writing dropped values, scales account balances
-- proportionally, and upserts the last 3 days of snapshots.
--
-- HOW TO USE:
--   1. Make sure seed_test_data_advisor2.sql + seed_snapshots.sql have run.
--   2. Run in Supabase Dashboard → SQL Editor.
-- =========================================================================

do $$
declare
  v_advisor_id uuid := '92de3c6a-786a-460d-8704-94f7228be169';

  -- (household_name, original_aum_from_seed, drop_multiplier, expected_alert_level)
  drops constant jsonb := '[
    {"name": "The Yamamoto Trust",  "orig": 7500000, "mult": 0.78, "level": "critical"},
    {"name": "The Park-Lee Trust",  "orig": 1900000, "mult": 0.87, "level": "warning"},
    {"name": "The Russo Family",    "orig": 1500000, "mult": 0.90, "level": "warning"},
    {"name": "The Asante Family",   "orig": 1600000, "mult": 0.95, "level": "info"}
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

    select v_target_aum / nullif(total_aum, 0)
    into v_account_factor
    from public.households where id = v_hh_id;

    if v_account_factor is null or v_account_factor = 1 then
      v_account_factor := v_mult;
    end if;

    -- 1. Live household total_aum.
    update public.households
    set total_aum = v_target_aum
    where id = v_hh_id;

    -- 2. Account balances proportional.
    update public.contact_accounts ca
    set balance = round((ca.balance * v_account_factor)::numeric, 2)
    from public.household_members hm
    where ca.member_id = hm.id
      and hm.household_id = v_hh_id;

    -- 3. Last 3 days of household snapshots.
    insert into public.household_snapshots (household_id, advisor_id, total_aum, snapshot_date)
    select v_hh_id, v_advisor_id, v_target_aum, d::date
    from generate_series(current_date - 2, current_date, interval '1 day') as d
    on conflict (household_id, snapshot_date)
      do update set total_aum = excluded.total_aum;

    -- 4. Account snapshots for the same window.
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

  -- 5. Rebuild advisor-level daily totals for the affected days.
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
--     where hh.advisor_id = '92de3c6a-786a-460d-8704-94f7228be169'
--       and hh.name in ('The Yamamoto Trust','The Park-Lee Trust','The Russo Family','The Asante Family')
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
