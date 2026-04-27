-- =========================================================================
-- TEST DATA SEED — wealth tiers, pending reviews, prospects, referrals
-- =========================================================================
--
-- Builds on scripts/seed_test_data.sql by:
--   1. Assigning real `wealth_tier` values (platinum/gold/silver) per
--      tierScoring.ts thresholds (>=75 platinum, >=50 gold, <50 silver).
--   2. Setting `tier_score` and `tier_last_assessed` so the scorecard
--      treats them as recently assessed.
--   3. Flagging 2 households with `tier_pending_review` so the
--      pending-review UI has data to display.
--   4. Inserting ~10 prospects covering every pipeline stage, mix of
--      sources, with several referred from existing households (so the
--      "referrals sent" count populates on Anderson/Whitfield/Castellanos/
--      Sullivan/O'Connor/Patel).
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

  v_anderson      uuid;
  v_whitfield     uuid;
  v_castellanos   uuid;
  v_sullivan      uuid;
  v_oconnor       uuid;
  v_patel         uuid;
  v_liu           uuid;
  v_bennett       uuid;
begin
  if not exists (select 1 from public.profiles where user_id = v_advisor_id) then
    raise exception 'Advisor user_id % not found in profiles', v_advisor_id;
  end if;

  -- ── 1. Wealth tier assignment ──
  -- Map total_aum bands to platinum/gold/silver per tierScoring.ts thresholds.
  -- These are coarse bands intentionally — calculateTierScore() is the
  -- authoritative scorer and would refine further given the income/age data.
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
  -- Liu Family and Bennett Family had recent AUM drops (see seed_aum_drops.sql).
  -- Flag both for tier review to populate the pending-review UI.
  select id into v_liu     from public.households
    where advisor_id = v_advisor_id and name = 'The Liu Family';
  select id into v_bennett from public.households
    where advisor_id = v_advisor_id and name = 'The Bennett Family';

  if v_liu is not null then
    update public.households
    set tier_pending_review = 'silver',
        tier_pending_score  = 48,
        tier_pending_reason = 'Recent 12% AUM drop on RSU concentration. Score now 48/100 — review for downgrade from gold to silver.'
    where id = v_liu;
  end if;

  if v_bennett is not null then
    update public.households
    set tier_pending_review = 'gold',
        tier_pending_score  = 52,
        tier_pending_reason = 'AUM crossed back above $570k after recent dip. Reassess: score 52 supports gold-tier upgrade.'
    where id = v_bennett;
  end if;

  -- ── 3. Lookup households we'll mark as referrers ──
  select id into v_anderson    from public.households
    where advisor_id = v_advisor_id and name = 'The Anderson Family';
  select id into v_whitfield   from public.households
    where advisor_id = v_advisor_id and name = 'The Whitfield Family Trust';
  select id into v_castellanos from public.households
    where advisor_id = v_advisor_id and name = 'The Castellanos Holdings';
  select id into v_sullivan    from public.households
    where advisor_id = v_advisor_id and name = 'The Sullivan Family Trust';
  select id into v_oconnor     from public.households
    where advisor_id = v_advisor_id and name = 'The O''Connor Estate';
  select id into v_patel       from public.households
    where advisor_id = v_advisor_id and name = 'The Patel Family';

  -- ── 4. Prospects (pipeline) ──
  -- Mix of stages and sources. 4 with referred_by_household_id set so the
  -- existing households' "referrals sent" count goes from 0 to nonzero.
  -- Idempotent on email (skip if already inserted by name+email).

  -- Lead stage — 2
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at)
  select v_advisor_id, 'Thomas', 'Chen', 'thomas.chen@chenmedical.com', '415-555-2210', 'Chen Medical Group', 'Cardiologist', 'lead', 750000, 'cold_outreach', null,
    'Reached out after LinkedIn connection. Mentioned interest in tax-efficient investing for high-W2 earner.', now() - interval '12 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'thomas.chen@chenmedical.com');

  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at)
  select v_advisor_id, 'Margaret', 'O''Brien', 'mobrien@obconsulting.io', '617-555-2347', 'O''Brien Strategy Consulting', 'Founder', 'lead', 1200000, 'event',
    'Met at FPA Northeast conference', 'Met at panel discussion on solo-401k optimization. Interested in retirement planning for self-employed.',
    now() - interval '9 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'mobrien@obconsulting.io');

  -- Contacted — 2
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'David', 'Park', 'd.park@parklawgroup.com', '212-555-2456', 'Park & Associates Law', 'Senior Partner', 'contacted', 2100000, 'referral',
    'Robert Whitfield', v_whitfield,
    'Whitfield introduced via email last month. Initial 30-min call complete. David interested in trust structures and tax planning. Sending follow-up materials.',
    now() - interval '18 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'd.park@parklawgroup.com');

  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at)
  select v_advisor_id, 'Lisa', 'Reyes', 'lisa.reyes@gmail.com', '305-555-2189', null, 'Marketing Manager', 'contacted', 400000, 'social_media',
    'Instagram inquiry', 'Reached out via Instagram DM after seeing financial wellness content. Two follow-up calls done. Open to discovery meeting.',
    now() - interval '14 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'lisa.reyes@gmail.com');

  -- Meeting scheduled — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Jennifer', 'Walsh', 'jennifer.walsh@walshfamily.org', '203-555-2078', 'Walsh Family Office', 'Trustee', 'meeting_scheduled', 3500000, 'referral',
    'James Anderson', v_anderson,
    'Anderson made warm intro at country club. Initial discovery call scheduled for next Tuesday at 10am. Walsh family office considering consolidation.',
    now() - interval '21 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'jennifer.walsh@walshfamily.org');

  -- Discovery complete (HOT) — 2
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Mark', 'Sullivan', 'mark.s@temple.edu', '215-555-2934', 'Temple University', 'Professor (Finance)', 'discovery_complete', 1600000, 'referral',
    'Patrick Sullivan (cousin)', v_sullivan,
    'Patrick''s cousin. 90-min discovery completed. Spouse a hospital administrator. Inheritance pending from parents'' estate ~$800k. Targeting proposal in 3 weeks.',
    now() - interval '32 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'mark.s@temple.edu');

  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Robert', 'Chen', 'r.chen@chentech.io', '305-555-2701', 'ChenTech Ventures', 'Founder/CEO', 'discovery_complete', 2800000, 'referral',
    'Carlos Castellanos', v_castellanos,
    'Carlos referred from Latin business owners network. Discovery covered concentration concerns from upcoming Series C. Strong fit for our concentration-management approach. Proposal in draft.',
    now() - interval '28 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'r.chen@chentech.io');

  -- Proposal sent (HOT) — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at)
  select v_advisor_id, 'Karen', 'Torres', 'karen.torres@torresmd.com', '609-555-2812', 'Torres Pediatric Practice', 'Pediatrician', 'proposal_sent', 980000, 'referral',
    'Priya Patel', v_patel,
    'Priya''s colleague. Practice owner with strong cash flow. Proposal sent 6 days ago: comprehensive plan + investment management. Decision expected within 2 weeks.',
    now() - interval '42 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'karen.torres@torresmd.com');

  -- Converted — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, referred_by_household_id, notes, created_at, converted_at)
  select v_advisor_id, 'Steven', 'Murphy', 's.murphy@murphycorp.net', '312-555-2624', 'Murphy Construction', 'Owner', 'converted', 1400000, 'referral',
    'William O''Connor', v_oconnor,
    'O''Connor friend from neighborhood. Converted 8 weeks ago — onboarding underway. Plan to spin into a full household record once accounts transfer.',
    now() - interval '95 days', now() - interval '56 days'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 's.murphy@murphycorp.net');

  -- Lost — 1
  insert into public.prospects (advisor_id, first_name, last_name, email, phone, company, job_title, pipeline_stage, estimated_aum, source, referred_by, notes, created_at, lost_reason)
  select v_advisor_id, 'Patricia', 'Lee', 'plee@gmail.com', null, null, 'Retired', 'lost', 600000, 'cold_outreach', null,
    'Reached via mass mailer. Two calls but ultimately preferred her existing relationship at Schwab Private Client.',
    now() - interval '70 days', 'Existing advisor relationship — not switching'
  where not exists (select 1 from public.prospects where advisor_id = v_advisor_id and email = 'plee@gmail.com');

  raise notice 'Tiers + pipeline + referrals seeded for advisor %.', v_advisor_id;
end $$;

-- =========================================================================
-- VERIFY
--
-- Wealth tier distribution:
--   select wealth_tier, count(*), to_char(sum(total_aum), '$FM999G999G999G999')
--   from households where advisor_id = '<your_id>' group by wealth_tier;
--
-- Pipeline by stage:
--   select pipeline_stage, count(*), to_char(sum(estimated_aum), '$FM999G999G999')
--   from prospects where advisor_id = '<your_id>' group by pipeline_stage
--   order by case pipeline_stage
--     when 'lead' then 1 when 'contacted' then 2 when 'meeting_scheduled' then 3
--     when 'discovery_complete' then 4 when 'proposal_sent' then 5
--     when 'converted' then 6 when 'lost' then 7 end;
--
-- Referrals sent per household (the ones with non-zero are flagged):
--   select hh.name, count(p.id) as referrals_sent
--   from households hh
--   left join prospects p on p.referred_by_household_id = hh.id
--   where hh.advisor_id = '<your_id>'
--   group by hh.name having count(p.id) > 0 order by count(p.id) desc;
--
-- Pending tier reviews:
--   select name, wealth_tier, tier_score, tier_pending_review, tier_pending_score, tier_pending_reason
--   from households where advisor_id = '<your_id>' and tier_pending_review is not null;
-- =========================================================================
