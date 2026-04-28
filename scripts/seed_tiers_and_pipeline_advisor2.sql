-- =========================================================================
-- TEST DATA SEED — wealth tiers, pending reviews, prospects, referrals
-- (advisor 2 — Beaumont/Yamamoto/Vance book)
-- =========================================================================
--
-- Mirrors scripts/seed_tiers_and_pipeline.sql but scoped to advisor 2 with
-- household-name lookups updated to match seed_test_data_advisor2.sql.
--
-- HOW TO USE:
--   1. Run scripts/seed_test_data_advisor2.sql first.
--   2. Run this in Supabase Dashboard → SQL Editor.
-- =========================================================================

do $$
declare
  v_advisor_id uuid := '92de3c6a-786a-460d-8704-94f7228be169';

  v_advisor_name text;
  v_beaumont    uuid;
  v_yamamoto    uuid;
  v_macgregor   uuid;
  v_parklee     uuid;
  v_howell      uuid;
  v_russo       uuid;
  v_ferreira    uuid;
  v_tan         uuid;
begin
  if not exists (select 1 from public.profiles where user_id = v_advisor_id) then
    raise exception 'Advisor user_id % not found in profiles', v_advisor_id;
  end if;

  select coalesce(full_name, email, 'Advisor') into v_advisor_name
  from public.profiles where user_id = v_advisor_id;

  -- ── 1. Wealth tier assignment ──
  -- Map total_aum bands to platinum/gold/silver per tierScoring.ts thresholds.
  update public.households
  set
    wealth_tier = case
      when total_aum >= 2000000 then 'platinum'
      when total_aum >=  800000 then 'gold'
      else 'silver'
    end,
    tier_score = case
      when total_aum >= 5000000 then 88
      when total_aum >= 2000000 then 78
      when total_aum >= 1000000 then 65
      when total_aum >=  500000 then 52
      else 38
    end,
    tier_last_assessed = now() - interval '180 days'
  where advisor_id = v_advisor_id;

  -- ── 2. Pending tier reviews ──
  select id into v_ferreira from public.households
    where advisor_id = v_advisor_id and name = 'The Ferreira Family';
  select id into v_tan      from public.households
    where advisor_id = v_advisor_id and name = 'The Tan Family';

  if v_ferreira is not null then
    update public.households
    set tier_pending_review = 'silver',
        tier_pending_score  = 49,
        tier_pending_reason = 'AUM hovering near $1M boundary; income-flow concerns. Review for downgrade from gold to silver.'
    where id = v_ferreira;
  end if;

  if v_tan is not null then
    update public.households
    set tier_pending_review = 'platinum',
        tier_pending_score  = 78,
        tier_pending_reason = 'Strong recent growth + planned inheritance ~$1M places Tan above platinum threshold by year-end.'
    where id = v_tan;
  end if;

  -- ── 3. Lookup households we'll mark as referrers ──
  select id into v_beaumont  from public.households
    where advisor_id = v_advisor_id and name = 'The Beaumont Estate';
  select id into v_yamamoto  from public.households
    where advisor_id = v_advisor_id and name = 'The Yamamoto Trust';
  select id into v_macgregor from public.households
    where advisor_id = v_advisor_id and name = 'The MacGregor Estate';
  select id into v_parklee   from public.households
    where advisor_id = v_advisor_id and name = 'The Park-Lee Trust';
  select id into v_howell    from public.households
    where advisor_id = v_advisor_id and name = 'The Howell Family';
  select id into v_russo     from public.households
    where advisor_id = v_advisor_id and name = 'The Russo Family';

  -- ── 4. Prospects (pipeline) ──
  -- Idempotent on email.

  -- Lead — 2
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at)
  select v_advisor_id, 'Daniel', 'Cho', 'daniel.cho@chosurgical.com', '617-555-3210', 'Cho Surgical Associates', 'Orthopedic Surgeon', 'lead', 980000, 'cold_outreach', null,
    'Cold outreach via LinkedIn. Mentioned interest in physician-focused tax planning and concentrated-stock diversification.', now() - interval '11 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'daniel.cho@chosurgical.com');

  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at)
  select v_advisor_id, 'Allison', 'Burke', 'allison@burkeventures.io', '512-555-3347', 'Burke Ventures', 'Managing Partner', 'lead', 1500000, 'event',
    'Met at Texas Capital Summit', 'Brief intro at conference cocktail. VC partner with growing portfolio; expressed interest in tax planning around carry distributions.',
    now() - interval '8 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'allison@burkeventures.io');

  -- Contacted — 2
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Rachel', 'Iverson', 'rachel.iverson@iversonlaw.com', '203-555-3456', 'Iverson & Hayes LLP', 'Senior Partner', 'contacted', 2400000, 'referral',
    'Charles Beaumont', v_beaumont,
    'Charles introduced via email. Initial 30-min discovery call complete. Rachel coordinating tax structure for upcoming firm liquidity event.',
    now() - interval '17 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'rachel.iverson@iversonlaw.com');

  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at)
  select v_advisor_id, 'Amir', 'Khan', 'amir.khan@gmail.com', '347-555-3189', null, 'Product Designer', 'contacted', 380000, 'social_media',
    'Twitter inquiry', 'Reached out via Twitter DM after seeing tax-strategy thread. Two follow-up calls done. Open to discovery meeting next month.',
    now() - interval '13 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'amir.khan@gmail.com');

  -- Meeting scheduled — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Caroline', 'Larsen', 'caroline.larsen@larsenfoundation.org', '415-555-3078', 'Larsen Family Office', 'Trustee', 'meeting_scheduled', 4200000, 'referral',
    'Hiroshi Yamamoto', v_yamamoto,
    'Yamamoto warm intro through SF MOMA board. Initial discovery scheduled for next week. Larsen family office considering consolidation of advisory relationships.',
    now() - interval '23 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'caroline.larsen@larsenfoundation.org');

  -- Discovery complete (HOT) — 2
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Marcus', 'Holloway', 'marcus.holloway@gmail.com', '412-555-3934', 'Holloway Energy Consulting', 'Senior Consultant', 'discovery_complete', 1700000, 'referral',
    'Angus MacGregor (former colleague)', v_macgregor,
    'Angus''s former colleague at Westinghouse. 90-min discovery completed. Pre-retirement at 62; pension lump-sum vs annuity decision ahead.',
    now() - interval '30 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'marcus.holloway@gmail.com');

  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Leah', 'Patel', 'leah.patel@stratoslabs.io', '650-555-3701', 'Stratos Labs', 'VP Engineering', 'discovery_complete', 2100000, 'referral',
    'Ji-Won Park', v_parklee,
    'Ji-Won referred from Stratos exec team. Discovery covered RSU concentration and pre-IPO concerns. Strong fit for our concentration-management approach. Proposal in draft.',
    now() - interval '26 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'leah.patel@stratoslabs.io');

  -- Proposal sent (HOT) — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'William', 'Tate', 'william.tate@tatemd.com', '704-555-3812', 'Carolinas Cardiology', 'Cardiologist', 'proposal_sent', 1100000, 'referral',
    'Jonathan Howell', v_howell,
    'Jonathan''s longtime physician friend. Proposal sent 5 days ago: comprehensive plan + investment management. Decision expected within 2 weeks.',
    now() - interval '40 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'william.tate@tatemd.com');

  -- Converted — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at, converted_at)
  select v_advisor_id, 'Eduardo', 'Vega', 'eduardo.vega@vegaprecision.com', '216-555-3624', 'Vega Precision Manufacturing', 'Owner', 'converted', 1600000, 'referral',
    'Vincent Russo', v_russo,
    'Russo introduction at Cleveland chamber event. Converted 9 weeks ago — onboarding underway. Plan to spin into a full household record once accounts transfer.',
    now() - interval '95 days', now() - interval '63 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'eduardo.vega@vegaprecision.com');

  -- Lost — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at, lost_reason)
  select v_advisor_id, 'Beatrice', 'Aldridge', 'b.aldridge@gmail.com', null, null, 'Retired', 'lost', 720000, 'cold_outreach', null,
    'Reached via mass mailer. Two calls but ultimately preferred her existing relationship at Edward Jones.',
    now() - interval '74 days', 'Existing advisor relationship — not switching'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'b.aldridge@gmail.com');

  raise notice 'Tiers + pipeline + referrals seeded for advisor %.', v_advisor_id;
end $$;

-- =========================================================================
-- VERIFY
--
-- Wealth tier distribution:
--   select wealth_tier, count(*), to_char(sum(total_aum), '$FM999G999G999G999')
--   from households where advisor_id = '92de3c6a-786a-460d-8704-94f7228be169' group by wealth_tier;
--
-- Pipeline by stage:
--   select pipeline_stage, count(*), to_char(sum(estimated_aum), '$FM999G999G999')
--   from prospects where advisor_id = '92de3c6a-786a-460d-8704-94f7228be169' group by pipeline_stage;
--
-- Referrals sent per household:
--   select hh.name, count(p.id) as referrals_sent
--   from households hh
--   left join prospects p on p.referred_by_household_id = hh.id
--   where hh.advisor_id = '92de3c6a-786a-460d-8704-94f7228be169'
--   group by hh.name having count(p.id) > 0 order by count(p.id) desc;
-- =========================================================================
