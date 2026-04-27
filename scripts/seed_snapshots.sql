-- =========================================================================
-- TEST DATA SEED — 60 days of historical snapshots
-- =========================================================================
--
-- Generates daily snapshots (account, household, and advisor-level) for
-- the past 60 days, scoped to one advisor's book of business. Realistic
-- pattern: ~7% net drift over the period + daily sine-wave wiggle, so
-- dashboard charts and the scorecard show plausible movement instead of
-- flat lines.
--
-- HOW TO USE:
--   1. Paste your advisor user_id below.
--   2. Run in Supabase Dashboard → SQL Editor.
--   3. Idempotent — re-running won't duplicate (UNIQUE constraint on
--      (account/household/advisor, snapshot_date) + ON CONFLICT DO NOTHING).
--
-- WHAT IT GENERATES (for each of the past 60 days, dates 1..60 days ago):
--   - account_snapshots:     1 row per active account per day
--   - household_snapshots:   1 row per household per day (sum of accounts)
--   - daily_snapshots:       1 row per advisor per day (sum + household count)
-- =========================================================================

do $$
declare
  -- ── EDIT THIS LINE ─────────────────────────────────────────────────────
  v_advisor_id uuid := '2f069cbb-f634-4279-8946-123a33faa9c2';
  -- ───────────────────────────────────────────────────────────────────────

  v_household_count int;
  v_total_aum numeric;
begin
  if not exists (select 1 from public.profiles where user_id = v_advisor_id) then
    raise exception 'Advisor user_id % not found in profiles', v_advisor_id;
  end if;

  -- ── 1. Account snapshots ──
  -- Drift: 60 days ago at ~93% of current value, today at ~100%.
  -- Wiggle: per-account phase-shifted sine, period ~7 days, amplitude ~0.6%.
  insert into public.account_snapshots (account_id, advisor_id, balance, snapshot_date)
  select
    ca.id,
    ca.advisor_id,
    round((ca.balance * (
      0.93
      + (60.0 - d) / 60.0 * 0.07
      + sin(d * pi() / 7.0 + (('x' || substr(md5(ca.id::text), 1, 8))::bit(32)::int) / 1.0e9) * 0.006
      + sin(d * pi() / 23.0) * 0.003
    ))::numeric, 2),
    (current_date - d::int)::date
  from public.contact_accounts ca
  cross join generate_series(1, 60) as d
  where ca.advisor_id = v_advisor_id
    and ca.status = 'active'
    and ca.archived_at is null
  on conflict (account_id, snapshot_date) do nothing;

  -- ── 2. Household snapshots ──
  -- Sum the per-account snapshots back up to household totals for the same dates.
  insert into public.household_snapshots (household_id, advisor_id, total_aum, snapshot_date)
  select
    hm.household_id,
    v_advisor_id,
    sum(asn.balance),
    asn.snapshot_date
  from public.account_snapshots asn
  join public.contact_accounts ca on ca.id = asn.account_id
  join public.household_members hm on hm.id = ca.member_id
  where asn.advisor_id = v_advisor_id
    and hm.household_id is not null
    and asn.snapshot_date >= current_date - 60
  group by hm.household_id, asn.snapshot_date
  on conflict (household_id, snapshot_date) do nothing;

  -- ── 3. Advisor daily snapshots ──
  -- Sum the per-household snapshots back up to advisor totals + count households.
  insert into public.daily_snapshots (advisor_id, total_aum, household_count, snapshot_date)
  select
    v_advisor_id,
    sum(hs.total_aum),
    count(distinct hs.household_id),
    hs.snapshot_date
  from public.household_snapshots hs
  where hs.advisor_id = v_advisor_id
    and hs.snapshot_date >= current_date - 60
  group by hs.snapshot_date
  on conflict (advisor_id, snapshot_date) do nothing;

  -- Summary
  select count(distinct snapshot_date), sum(total_aum) filter (where snapshot_date = current_date - 1)
  into v_household_count, v_total_aum
  from public.daily_snapshots
  where advisor_id = v_advisor_id;

  raise notice 'Generated snapshots for % unique days. Yesterday''s total AUM: $%',
    v_household_count, v_total_aum;
end $$;

-- =========================================================================
-- VERIFY
--
-- After running, sanity-check the data:
--
--   select snapshot_date, total_aum, household_count
--   from daily_snapshots
--   where advisor_id = '<your_advisor_id>'
--   order by snapshot_date desc
--   limit 10;
--
-- You should see ~60 rows with total_aum trending upward day over day,
-- with mild noise. Yesterday's total should be close to (but not exactly)
-- the current sum of households.total_aum.
-- =========================================================================
