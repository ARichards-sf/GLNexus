-- =========================================================================
-- TEST DATA SEED — second advisor book of business, ~$50M total AUM
-- =========================================================================
--
-- Mirrors scripts/seed_test_data.sql but with different families so the
-- two demo advisors have distinct, non-overlapping books.
--
-- HOW TO USE:
--   1. UUIDs are pre-filled per the request (advisor_id +
--      firm_id). Verify the advisor + firm exist and are linked via
--      firm_memberships.
--   2. Paste this whole file into Supabase Dashboard → SQL Editor → Run.
--   3. After it succeeds, run scripts/seed_snapshots.sql with the same
--      advisor_id pasted in to get 60 days of historical snapshots.
--   4. Optionally run scripts/seed_aum_drops.sql + seed_tiers_and_pipeline.sql
--      with the new advisor_id to wire up Scorecard alerts and the
--      prospect pipeline.
--   5. Sign in as this advisor and run the backfill-embeddings snippet
--      from DevTools so Goodie can RAG over their book.
--
-- DISTRIBUTION (~$50M total across 30 households):
--   Prime    (3)  — $5M+         — $21.8M (Beaumont, Yamamoto, Vance)
--   Premier (12)  — $750k-$2.5M  — $19.0M
--   Core    (12)  — $470k-$1.05M — $8.6M
--   Standard (3)  — under $400k  — $0.9M
-- =========================================================================

do $$
declare
  v_advisor_id uuid := '92de3c6a-786a-460d-8704-94f7228be169';
  v_firm_id    uuid := '6f6297f9-d01c-4252-8d34-f72a7cb71e54';

  v_advisor_name text;
  v_hh_id  uuid;
  v_m1_id  uuid;
  v_m2_id  uuid;
begin
  if not exists (select 1 from public.profiles where user_id = v_advisor_id) then
    raise exception 'Advisor user_id % not found in profiles', v_advisor_id;
  end if;
  if not exists (select 1 from public.firms where id = v_firm_id) then
    raise exception 'Firm id % not found in firms', v_firm_id;
  end if;
  if not exists (
    select 1 from public.firm_memberships
    where user_id = v_advisor_id and firm_id = v_firm_id
  ) then
    raise warning 'Advisor % is not a member of firm % — seeding anyway, but firm-scoped views may not include this data',
      v_advisor_id, v_firm_id;
  end if;

  select coalesce(full_name, email, 'Advisor') into v_advisor_name
  from public.profiles where user_id = v_advisor_id;

  -- =========================================================================
  -- PRIME TIER  (3 households, $21.8M)
  -- =========================================================================

  -- ── 1. Beaumont Estate — $7.8M, Greenwich CT, multi-gen wealth ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date, next_action, next_action_date)
  values (v_advisor_id, 'The Beaumont Estate', 7800000, 'Prime', 'Active', 'Conservative',
    'Multi-generational wealth preservation across four trusts. Income stability and tax-efficient transfers to grandchildren.',
    920000, '2026-09-12', '2025-09-09', 'Review GST exemption usage with estate counsel', '2026-06-15')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, has_poa, has_healthcare_directive, primary_goal, address_line1, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Charles', 'Beaumont', 'Primary', '1958-11-04', 'charles@beaumontholdings.com', '203-555-1101', 'married', 'employed', 'Chairman', 'Beaumont Holdings Inc', 920000, true, true, true, true,
    'Preserve principal, fund family foundation, transfer assets to next generation', '88 Lake Avenue', 'Greenwich', 'CT', '06831', '2028-12-31')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, has_will, has_trust, has_poa, has_healthcare_directive, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Vivian', 'Beaumont', 'Spouse', '1961-03-19', 'vivian.beaumont@gmail.com', '203-555-1102', 'married', 'retired', true, true, true, true, '88 Lake Avenue', 'Greenwich', 'CT', '06831')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Beaumont Generation-Skipping Trust', 'Trust',     4600000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Charles Beaumont Brokerage',         'Brokerage', 1900000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Charles Beaumont Rollover IRA',      'Retirement', 750000, 'active', 'Fidelity'),
    (v_advisor_id, v_m2_id, 'Vivian Beaumont IRA',                'Retirement', 550000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-09-09', 'Annual Review',
     'Comprehensive review with Charles and Vivian. Generation-skipping trust performed at 7.8% YTD. Discussed accelerating GST exemption usage given the 2026 sunset of the elevated exemption — modeled gifting $5M into dynasty trust for grandchildren before year-end. Vivian wants to revisit family foundation governance; introduced Cravath estate team for succession-planning input.',
     v_advisor_name, ARRAY['Estate Planning','Tax Planning','Trust Administration'], 95),
    (v_advisor_id, v_hh_id, '2026-02-18', 'Phone Call',
     'Charles called regarding upcoming bond ladder maturity. Reinvested $400k into intermediate-term municipals at 4.2% TEY. Reminded Charles that we''re monitoring corporate transition bonds for portfolio addition this year.',
     v_advisor_name, ARRAY['Fixed Income','Tax Planning'], 30);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, description, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Beaumont GST exemption modeling',
     'Run scenarios for accelerated lifetime gifting before 2026 sunset. Coordinate with their estate attorney.', 'todo', 'high', 'review', '2026-06-15');

  insert into calendar_events (advisor_id, household_id, title, description, start_time, end_time, event_type, status) values
    (v_advisor_id, v_hh_id, 'Beaumont Annual Review', 'Annual portfolio review and estate planning discussion',
     '2025-09-09 13:00:00+00', '2025-09-09 15:00:00+00', 'Annual Review', 'completed'),
    (v_advisor_id, v_hh_id, 'Beaumont Estate Planning Working Session', 'Joint meeting with Cravath team on dynasty trust funding',
     '2026-06-15 14:00:00+00', '2026-06-15 16:00:00+00', 'Meeting', 'scheduled');

  -- ── 2. Yamamoto Trust — $7.5M, San Francisco CA, art collector / philanthropy ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date, next_action, next_action_date)
  values (v_advisor_id, 'The Yamamoto Trust', 7500000, 'Prime', 'Active', 'Moderate',
    'Balanced growth with significant alternative allocation. Art-collection liquidity planning and structured charitable giving via private foundation.',
    1100000, '2026-05-14', '2025-05-12', 'Coordinate art appraisal with Bonhams for 2026 charitable contribution', '2026-04-30')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, has_poa, has_healthcare_directive, primary_goal, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Hiroshi', 'Yamamoto', 'Primary', '1956-07-22', 'hiroshi@yamamotofoundation.org', '415-555-1203', 'married', 'employed', 'Founder/Chairman', 'Yamamoto Foundation', 1100000, true, true, true, true,
    'Sustain foundation operations through ongoing endowment funding; coordinate art-to-philanthropy strategy', '2950 Pacific Ave', 'San Francisco', 'CA', '94115')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, has_will, has_trust, primary_goal, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Akiko', 'Yamamoto', 'Spouse', '1959-12-11', 'akiko.y@gmail.com', 'married', 'retired', true, true,
    'Active in board service for SF MOMA; coordinate giving to align with foundation', '2950 Pacific Ave', 'San Francisco', 'CA', '94115')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Yamamoto Family Foundation Endowment', 'Trust',         3800000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Hiroshi Yamamoto Brokerage',           'Brokerage',     1450000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Yamamoto Charitable DAF',              'Donor-Advised',  650000, 'active', 'Schwab Charitable'),
    (v_advisor_id, v_m1_id, 'Hiroshi Yamamoto IRA',                 'Retirement',     900000, 'active', 'Fidelity'),
    (v_advisor_id, v_m2_id, 'Akiko Yamamoto IRA',                   'Retirement',     700000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-05-12', 'Annual Review',
     'Reviewed foundation endowment performance with Hiroshi and Akiko. Endowment up 8.4% YTD with the alternatives sleeve outperforming. Discussed art-to-charity transition: 12-piece Japanese contemporary collection ($4M+ appraised) earmarked for partial gift to MOMA; need Bonhams updated appraisal before year-end. Foundation grant-making averaging $850k/yr.',
     v_advisor_name, ARRAY['Portfolio Review','Philanthropy','Estate Planning','Alternatives'], 90),
    (v_advisor_id, v_hh_id, '2025-12-05', 'Email',
     'Akiko emailed asking about year-end DAF contribution timing. Recommended $200k contribution from concentrated tech position; Schwab Charitable will accept in-kind transfer for clean basis step-up.',
     v_advisor_name, ARRAY['Tax Planning','Philanthropy'], NULL);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, description, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Yamamoto art appraisal coordination',
     'Coordinate with Bonhams for updated appraisal on 12-piece collection ahead of MOMA partial-gift discussion.', 'todo', 'high', 'admin', '2026-04-30');

  insert into calendar_events (advisor_id, household_id, title, start_time, end_time, event_type, status) values
    (v_advisor_id, v_hh_id, 'Yamamoto Annual Review', '2025-05-12 09:00:00+00', '2025-05-12 10:30:00+00', 'Annual Review', 'completed'),
    (v_advisor_id, v_hh_id, 'Yamamoto Foundation Strategy Session', '2026-05-14 14:00:00+00', '2026-05-14 15:30:00+00', 'Annual Review', 'scheduled');

  -- ── 3. Vance Family — $6.5M, Austin TX, recent divorce settlement ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date, next_action, next_action_date)
  values (v_advisor_id, 'The Vance Family', 6500000, 'Prime', 'Active', 'Moderate',
    'Recently divorced; rebuilding portfolio from settlement proceeds. Income-replacement focus and long-horizon growth for two children''s trusts.',
    340000, '2026-11-22', '2025-11-19', 'Finalize 2026 alimony tax-treatment review with CPA', '2026-04-15')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, has_poa, primary_goal, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Elena', 'Vance', 'Primary', '1972-04-08', 'elena@vanceconsulting.io', '512-555-1305', 'divorced', 'self-employed', 'Founder', 'Vance Strategy Consulting', 340000, true, true, true,
    'Rebuild financial independence post-divorce; protect children''s trusts and minimize alimony tax impact', '2204 Travis Heights Blvd', 'Austin', 'TX', '78704')
  returning id into v_m1_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Vance Settlement Brokerage',     'Brokerage',  3200000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Vance Children''s Trust I (UTMA)','Trust',      1100000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Vance Children''s Trust II (UTMA)','Trust',      1050000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Elena Vance SEP IRA',             'Retirement',  900000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Elena Vance Cash Reserve',        'Cash',        250000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-11-19', 'Annual Review',
     'First full year managing Elena''s portfolio post-divorce. Settlement proceeds invested per IPS — 60/40 with growth tilt. Children''s UTMA trusts age-locked until 21/25. Discussed alimony tax treatment under TCJA — non-deductible to payer / non-taxable to Elena, materially different from pre-2018 settlements. Coordinated with CPA on quarterly estimate adjustments.',
     v_advisor_name, ARRAY['Portfolio Review','Tax Planning','Divorce Planning','Cash Flow'], 85),
    (v_advisor_id, v_hh_id, '2026-01-30', 'Meeting',
     'In-person at Austin office. Elena considering early access to UTMA for older child''s undergrad. Walked through alternatives: scholarships, parent-PLUS, or partial UTMA distribution. Recommended preserving UTMA principal; will revisit if FAFSA gap opens.',
     v_advisor_name, ARRAY['Education Planning','Trust Administration'], 75);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, description, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Vance 2026 alimony tax-treatment review',
     'Coordinate with CPA on quarterly estimate adjustments and confirm settlement payment characterization.', 'todo', 'high', 'review', '2026-04-15');

  insert into calendar_events (advisor_id, household_id, title, start_time, end_time, event_type, status) values
    (v_advisor_id, v_hh_id, 'Vance Q2 Check-in', '2026-04-22 16:00:00+00', '2026-04-22 17:00:00+00', 'Quarterly Review', 'scheduled');

  -- =========================================================================
  -- PREMIER TIER  (12 households, $19.0M)
  -- =========================================================================

  -- ── 4. Donovan Family — $1.3M, Boston MA, dual-physician household ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Donovan Family', 1300000, 'Premier', 'Active', 'Moderate',
    'Dual-physician income; loan-forgiveness optimization, college funding for three kids, retirement at 60.', 540000, '2026-08-04', '2025-08-01')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Sean', 'Donovan', 'Primary', '1981-02-14', 'sean.donovan@bidmc.org', '617-555-1421', 'married', 'employed', 'Anesthesiologist', 'Beth Israel Deaconess', 320000, 'Pay down med-school debt, fund 529s, retire by 60', 'Brookline', 'MA', '02446')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, company, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Megan', 'Donovan', 'Spouse', '1983-09-25', 'megan.d@bostonchildrens.org', 'married', 'employed', 'Pediatrician', 'Boston Children''s', 220000, 'Brookline', 'MA', '02446')
  returning id into v_m2_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Sean Donovan 401(k)',     'Retirement', 480000, 'active', 'Fidelity'),
    (v_advisor_id, v_m2_id, 'Megan Donovan 403(b)',    'Retirement', 410000, 'active', 'TIAA'),
    (v_advisor_id, v_m1_id, 'Donovan Joint Brokerage', 'Brokerage',  220000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Donovan 529 (combined)',  '529',        190000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-08-01', 'Annual Review',
     'Reviewed loan-forgiveness progress — Megan on track for PSLF in 14 months. Sean refinanced with SoFi at 5.2%. Bumped joint brokerage to $4k/mo for taxable bridge to age-60 retirement.',
     v_advisor_name, ARRAY['Debt Management','Retirement Planning','Education Planning'], 60);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Donovan PSLF certification reminder', 'todo', 'medium', 'admin', '2026-04-30');

  -- ── 5. Park-Lee Trust — $1.9M, Sunnyvale CA, pre-IPO tech ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Park-Lee Trust', 1900000, 'Premier', 'Active', 'Aggressive',
    'Pre-IPO tech founder; concentrated equity management ahead of expected liquidity event.', 380000, '2026-06-30', '2025-06-27')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Ji-Won', 'Park', 'Primary', '1984-09-12', 'jiwon@stratoslabs.io', 'married', 'self-employed', 'Co-Founder/CTO', 380000, 'Stratos Labs IPO targeted Q4 2026; pre-transaction planning + diversification post-lockup', 'Sunnyvale', 'CA', '94087')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Sarah', 'Lee', 'Spouse', '1986-04-03', 'married', 'employed', 'Sunnyvale', 'CA', '94087');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Park Stratos Founder Equity (illiquid)','Brokerage',     950000, 'active', 'Carta'),
    (v_advisor_id, v_m1_id, 'Park Solo 401(k)',                     'Retirement',     440000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Park-Lee Joint Brokerage',             'Brokerage',      330000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Park-Lee Cash Reserve',                'Cash',           180000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-06-27', 'Annual Review',
     'Stratos Labs S-1 filing expected Q3 2026; IPO targeted Q4. Ji-Won''s founder equity ~50% of net worth. Pre-transaction planning: 83(b) election confirmed, QSBS clock running, exploring NING for state-tax mitigation given CA residency. 10b5-1 plan to be drafted post-pricing.',
     v_advisor_name, ARRAY['Liquidity Event','Tax Planning','Concentration','Pre-IPO'], 95);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Park-Lee NING vs. trust comparison', 'todo', 'high', 'review', '2026-05-30');

  -- ── 6. Asante Family — $1.6M, Atlanta GA, small business owner ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Asante Family', 1600000, 'Premier', 'Active', 'Moderate',
    'Small business owner; SEP IRA primary, succession planning, balance growth + tax efficiency.', 295000, '2026-07-08', '2025-07-05')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Kwame', 'Asante', 'Primary', '1973-11-08', 'kwame@asantelogistics.com', '404-555-1532', 'married', 'self-employed', 'Owner', 'Asante Logistics LLC', 295000, 'Sell business in 5-7 years; build retirement nest egg', 'Atlanta', 'GA', '30309')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Adwoa', 'Asante', 'Spouse', '1976-05-22', 'married', 'employed', 'Marketing Director', 130000, 'Atlanta', 'GA', '30309');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Kwame Asante SEP IRA',         'Retirement', 720000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Asante Joint Brokerage',       'Brokerage',  490000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Asante 529 (combined)',        '529',        180000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Asante HSA',                   'HSA',        130000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Adwoa Asante 401(k)',          'Retirement',  80000, 'active', 'Vanguard');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-07-05', 'Annual Review',
     'Asante Logistics revenue ~$8M, EBITDA growing 14%. Kwame considering selling to a strategic buyer in 5-7 years. Modeled QSBS-eligibility issue (LLC, may need C-corp restructure). Maxed SEP at 25% of comp. HSA fully invested.',
     v_advisor_name, ARRAY['Retirement Planning','Tax Planning','Business Owner','Self-Employment'], 75);

  -- ── 7. MacGregor Estate — $2.3M, Edinburgh-themed Pittsburgh PA, retired exec ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The MacGregor Estate', 2300000, 'Premier', 'Active', 'Conservative',
    'Retired energy executive; sustainable withdrawal strategy and legacy planning.', 110000, '2026-03-18', '2025-03-15')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, has_will, has_trust, has_poa, has_healthcare_directive, primary_goal, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Angus', 'MacGregor', 'Primary', '1956-10-14', 'angus.macgregor@gmail.com', '412-555-1648', 'married', 'retired', true, true, true, true, 'Maintain lifestyle through 95; legacy for grandchildren', 'Sewickley', 'PA', '15143', '2021-12-31')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, has_will, has_trust, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Fiona', 'MacGregor', 'Spouse', '1959-06-02', 'married', 'retired', true, true, 'Sewickley', 'PA', '15143', '2023-06-30')
  returning id into v_m2_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Angus MacGregor Pension Rollover IRA','Retirement', 1180000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m2_id, 'Fiona MacGregor IRA',                 'Retirement',  620000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'MacGregor Joint Brokerage',           'Brokerage',   500000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-03-15', 'Annual Review',
     '4th year of retirement. Withdrawal rate 3.6%, sustainable. Discussed long-term care: Fiona signed onto a hybrid life/LTC policy in February. Reviewed beneficiaries — three adult children + four grandchildren via per stirpes.',
     v_advisor_name, ARRAY['Retirement Income','Insurance','Estate Planning'], 70);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'MacGregor 2026 RMD coordination', 'todo', 'high', 'admin', '2026-12-15');

  -- ── 8. Ferreira Family — $980k, Miami FL, mid-career engineer ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Ferreira Family', 980000, 'Premier', 'Active', 'Moderate',
    'Mid-career; aggressive accumulation and bilingual estate-planning focus.', 245000, '2026-10-09', '2025-10-06')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, company, annual_income, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Mateus', 'Ferreira', 'Primary', '1980-08-28', 'mateus@nextgen.aero', 'married', 'employed', 'Senior Engineer', 'NextGen Aerospace', 245000, 'Buy first home next year; ramp retirement savings', 'Coral Gables', 'FL', '33134')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Mateus Ferreira 401(k)',  'Retirement', 510000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Ferreira Joint Brokerage','Brokerage',  240000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Ferreira Down Payment',   'Cash',       180000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Mateus Ferreira Roth IRA','Retirement',  50000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-10-06', 'Annual Review',
     'Ferreira shopping for $750k home in Coral Gables. Down payment in T-bills + HYSA. Discussed mortgage rate environment; pre-approved with Bank of America at 6.5%. Continuing backdoor Roth strategy.',
     v_advisor_name, ARRAY['Real Estate','Cash Management','Tax Planning'], 50);

  -- ── 9. Karlsson Trust — $1.9M, Minneapolis MN ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Karlsson Trust', 1900000, 'Premier', 'Active', 'Moderate',
    'Dual-income with three kids; tax-advantaged accumulation and 529 funding.', 295000, '2026-04-12', '2025-04-09')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Lars', 'Karlsson', 'Primary', '1976-12-01', 'lars.karlsson@medtronic.com', 'married', 'employed', 'Director of Engineering', 220000, 'Fund 3 kids'' college, retire at 62', 'Edina', 'MN', '55424')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Astrid', 'Karlsson', 'Spouse', '1979-02-17', 'married', 'employed', 'Veterinarian', 75000, 'Edina', 'MN', '55424');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Lars Karlsson 401(k)',     'Retirement', 880000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Karlsson Joint Brokerage', 'Brokerage',  430000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Karlsson 529 (combined)',  '529',        420000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Lars Karlsson IRA',        'Retirement',  170000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-04-09', 'Annual Review',
     'Three kids ages 11/14/17. Oldest enters college fall 2026; 529 fully funded for state-school tuition. Discussed Coverdell vs additional 529 — sticking with 529. Lars maxed 401(k) + after-tax mega-backdoor Roth.',
     v_advisor_name, ARRAY['Education Planning','Retirement Planning','Roth Conversions'], 60);

  -- ── 10. Howell Family — $2.5M, Charlotte NC, trust beneficiary ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Howell Family', 2500000, 'Premier', 'Active', 'Moderate',
    'Trust beneficiary plus current income; balanced growth.', 365000, '2026-02-26', '2025-02-23')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, has_will, has_trust, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Jonathan', 'Howell', 'Primary', '1971-07-30', 'jonathan@howellconsulting.com', 'married', 'employed', 'Managing Partner', 365000, true, true, 'Honor inheritance, fund kids'' grad school, comfortable retirement', 'Charlotte', 'NC', '28207')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Howell Family Trust',       'Trust',      1450000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Jonathan Howell 401(k)',    'Retirement',  650000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Howell Joint Brokerage',    'Brokerage',   400000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-02-23', 'Annual Review',
     'Trust performing 7.4% CAGR over 5 years. Two children entering grad school (MBA + JD). Increased trust distributions to fund tuition without disturbing principal. Reviewed beneficiary designations.',
     v_advisor_name, ARRAY['Portfolio Review','Education Planning','Trust Administration'], 70);

  -- ── 11. Kapoor Trust — $1.4M, Houston TX, surgeon nearing retirement ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Kapoor Trust', 1400000, 'Premier', 'Active', 'Moderate',
    'Surgeon nearing retirement; income-replacement focus and Roth conversion ladder.', 480000, '2026-06-04', '2025-06-01')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, primary_goal, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Anil', 'Kapoor', 'Primary', '1965-03-15', 'akapoor@hmh.org', 'married', 'employed', 'Cardiothoracic Surgeon', 'Houston Methodist', 480000, true, true, 'Retire at 65; income replacement of $200k/yr from portfolio', 'Bellaire', 'TX', '77401', '2030-06-30')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, job_title, has_will, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Priya', 'Kapoor', 'Spouse', '1968-08-04', 'married', 'employed', 'Pharmacist', true, 'Bellaire', 'TX', '77401');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Anil Kapoor 401(k)',          'Retirement', 720000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Anil Kapoor Rollover IRA',    'Retirement', 360000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Kapoor Joint Brokerage',      'Brokerage',  220000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Kapoor HSA',                  'HSA',        100000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-06-01', 'Annual Review',
     '5 years from Anil''s target retirement. Modeled Roth conversion ladder starting age 60 — convert $90k/yr through age 70 to optimize lifetime taxes. Priya considering reduced hours next year; updated cash flow plan.',
     v_advisor_name, ARRAY['Retirement Planning','Tax Planning','Roth Conversions'], 65);

  -- ── 12. Russo Family — $1.5M, Cleveland OH, family business succession ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Russo Family', 1500000, 'Premier', 'Active', 'Moderate',
    'Multi-generation family business; succession planning to son and tax-efficient wealth transfer.', 285000, '2026-08-19', '2025-08-16')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Vincent', 'Russo', 'Primary', '1964-01-22', 'vincent@russofabrication.com', 'married', 'self-employed', 'CEO/Owner', 'Russo Fabrication Inc', 285000, true, true, 'Transition business to son over 5 years; secure retirement', 'Mayfield', 'OH', '44143')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Vincent Russo SEP IRA',       'Retirement', 680000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Russo Joint Brokerage',       'Brokerage',  430000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Russo Family Trust',          'Trust',      390000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-08-16', 'Annual Review',
     'Russo Fab transition plan: 60% sold to son via SCIN over 5 years, 40% gifted via grantor-retained annuity trust. CPA modeled estate tax impact; saves ~$3M vs outright sale. Vincent comfortable with 7-year glide path.',
     v_advisor_name, ARRAY['Business Owner','Estate Planning','Tax Planning','Succession'], 80);

  -- ── 13. Bauer Estate — $2.0M, Chicago IL, pre-retirees ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Bauer Estate', 2000000, 'Premier', 'Active', 'Conservative',
    'Pre-retirees; Roth conversion ladder + sequence-of-returns risk mitigation.', 195000, '2026-09-29', '2025-09-26')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, has_will, has_trust, has_poa, primary_goal, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Frederick', 'Bauer', 'Primary', '1962-05-11', 'fred.bauer@gmail.com', 'married', 'employed', 'Tax Director', 195000, true, true, true, 'Retire at 65, glide-path conservative + Roth conversions', 'Naperville', 'IL', '60540', '2027-12-31')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, has_will, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Helena', 'Bauer', 'Spouse', '1964-09-28', 'married', 'retired', true, 'Naperville', 'IL', '60540', '2024-12-31');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Frederick Bauer 401(k)',  'Retirement', 1100000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Bauer Joint Brokerage',   'Brokerage',   620000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Frederick Bauer IRA',     'Retirement',  280000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-09-26', 'Annual Review',
     'Two years to Fred''s retirement. Glide path 70/30 → 55/45 by retirement date. Roth conversion ladder modeled — convert $75k/yr in 22% bracket through age 70.',
     v_advisor_name, ARRAY['Retirement Planning','Roth Conversions','Glide Path'], 65);

  -- ── 14. Tran Trust — $820k, Westminster CA, refugee family ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Tran Trust', 820000, 'Premier', 'Active', 'Conservative',
    'First-generation immigrant family; conservative allocation with strong liquidity.', 150000, '2026-12-04', '2025-12-01')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, has_will, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Quan', 'Tran', 'Primary', '1969-06-13', 'quan.tran@gmail.com', 'married', 'employed', 'Restaurant Owner', 90000, true, 'Educate children, retire comfortably, support family in Vietnam', 'Westminster', 'CA', '92683')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Linh', 'Tran', 'Spouse', '1972-11-04', 'married', 'employed', 60000, 'Westminster', 'CA', '92683');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Tran Family Brokerage',     'Brokerage', 380000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Quan Tran SEP IRA',         'Retirement', 240000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Tran Cash Reserve',         'Cash',       120000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Tran 529 (combined)',       '529',         80000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-12-01', 'Annual Review',
     'Strong saver. Discussed eligibility for additional Coverdell — kept simple with 529. Cash reserve high (15 months expenses) — Quan prefers it given restaurant cyclicality. No changes.',
     v_advisor_name, ARRAY['Cash Management','Education Planning','Self-Employment'], 50);

  -- ── 15. McKinley Family — $750k, Asheville NC, single mother ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The McKinley Family', 750000, 'Premier', 'Active', 'Moderate',
    'Single mother with three children; survivor benefit + earned income.', 110000, '2026-04-08', '2025-04-05')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, annual_income, has_will, has_trust, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Brianna', 'McKinley', 'Primary', '1984-03-26', 'brianna.mckinley@misslab.org', '828-555-1655', 'widowed', 'employed', 'Senior Researcher', 110000, true, true, 'Stable income for three children; college funding', 'Asheville', 'NC', '28801')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'McKinley Survivor Benefit IRA',  'Retirement', 380000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Brianna McKinley 403(b)',        'Retirement', 120000, 'active', 'TIAA'),
    (v_advisor_id, v_m1_id, 'McKinley 529 (combined)',        '529',        180000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'McKinley Brokerage',             'Brokerage',   70000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-04-05', 'Annual Review',
     'Brianna doing well 3 years post-loss. Survivor benefits providing solid base. 529 funding on track for three kids. Considering grad-school MBA — modeled scenarios with reduced income year.',
     v_advisor_name, ARRAY['Retirement Planning','Education Planning','Insurance'], 60);

  -- =========================================================================
  -- CORE TIER  (12 households, $8.6M)
  -- =========================================================================

  -- 16. Holloway Family - $640k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Holloway Family', 640000, 'Core', 'Active', 'Moderate',
    'Mid-career professionals; balanced portfolio.', 155000, '2026-07-22')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Jameson', 'Holloway', 'Primary', '1980-07-19', 'jhollow@gmail.com', 'married', 'employed', 'IT Director', 155000, 'Raleigh', 'NC', '27601')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Jameson Holloway 401(k)',  'Retirement', 390000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Holloway Joint Brokerage', 'Brokerage',  185000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Holloway Roth IRA',        'Retirement',  65000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-07-19', 'Annual Review', 'Reviewed allocation, increased 401(k) to max. On track for 60-year-old retirement.', v_advisor_name, ARRAY['Retirement Planning'], 45);

  -- 17. Schmidt Family - $890k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Schmidt Family', 890000, 'Core', 'Active', 'Moderate', 'Empty nesters; pre-retirement glide path.', 180000, '2026-05-29')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Heinrich', 'Schmidt', 'Primary', '1965-04-21', 'heinrich.schmidt@gmail.com', 'married', 'employed', 'Operations Director', 180000, 'St. Louis', 'MO', '63108', '2030-06-30')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Greta', 'Schmidt', 'Spouse', '1967-08-12', 'married', 'employed', 65000, 'St. Louis', 'MO', '63108');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Heinrich Schmidt 401(k)',   'Retirement', 530000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Schmidt Joint Brokerage',   'Brokerage',  240000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Schmidt Cash Reserve',      'Cash',       120000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-05-26', 'Annual Review', 'Glide path: 50/50 in 36 months. SS claiming at 67 vs 70 modeled.', v_advisor_name, ARRAY['Retirement Planning','Glide Path'], 50);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date)
    values (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Schmidt SS claiming analysis', 'todo', 'medium', 'review', '2026-06-30');

  -- 18. Aldridge Trust - $530k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Aldridge Trust', 530000, 'Core', 'Active', 'Conservative', 'Trust beneficiary; income-focused.', 60000, '2026-04-01')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, has_trust, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Wendell', 'Aldridge', 'Primary', '1969-12-27', 'wendell.a@gmail.com', 'single', 'employed', 'Librarian', 60000, true, 'Eugene', 'OR', '97401')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Aldridge Inherited Trust', 'Trust',     400000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Wendell Aldridge IRA',     'Retirement', 130000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-03-29', 'Annual Review', 'Trust providing $1,300/mo distribution. No major changes.', v_advisor_name, ARRAY['Portfolio Review'], 30);

  -- 19. Garcia Family - $720k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Garcia Family', 720000, 'Core', 'Active', 'Moderate', 'Mid-career; new home purchase planning.', 175000, '2026-08-31')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Mariana', 'Garcia', 'Primary', '1985-04-15', 'mariana.garcia@gmail.com', 'married', 'employed', 'Sales Director', 100000, 'Phoenix', 'AZ', '85003')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Garcia 401(k)',                 'Retirement', 400000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Garcia Joint Brokerage',         'Brokerage',  210000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Garcia Home Down Payment Fund', 'Cash',       110000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-08-28', 'Annual Review', 'Home purchase 12-18 months out. Down payment in T-bills + HYSA.', v_advisor_name, ARRAY['Cash Management','Real Estate'], 50);

  -- 20. Walsh Family - $810k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Walsh Family', 810000, 'Core', 'Active', 'Moderate', 'Two-earner family with one child.', 200000, '2026-09-29')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Daniel', 'Walsh', 'Primary', '1978-09-02', 'daniel.walsh@gmail.com', 'married', 'employed', 'Architect', 130000, 'Portland', 'OR', '97205')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Daniel Walsh 401(k)',   'Retirement', 460000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Walsh Joint Brokerage', 'Brokerage',  240000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Walsh 529',             '529',        110000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-09-26', 'Annual Review', 'Daughter starts middle school. Continuing $400/mo into 529.', v_advisor_name, ARRAY['Education Planning','Retirement Planning'], 40);

  -- 21. Petrov Family - $580k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Petrov Family', 580000, 'Core', 'Active', 'Moderate', 'Mid-career; aggressive accumulation.', 145000, '2026-12-15')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Yulia', 'Petrov', 'Primary', '1986-10-20', 'yulia.petrov@gmail.com', 'married', 'employed', 'UX Lead', 145000, 'Seattle', 'WA', '98101')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Yulia Petrov 401(k)',     'Retirement', 320000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Petrov Joint Brokerage',  'Brokerage',  175000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Petrov Roth IRA',         'Retirement',  85000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-12-12', 'Annual Review', 'On track. Yulia maxing backdoor Roth. Newly married 2024; updated beneficiaries.', v_advisor_name, ARRAY['Retirement Planning','Tax Planning'], 45);

  -- 22. Maxwell Family - $470k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Maxwell Family', 470000, 'Core', 'Active', 'Moderate', 'Building emergency reserves and retirement.', 115000, '2026-07-15')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Curtis', 'Maxwell', 'Primary', '1990-04-22', 'curtis.maxwell@gmail.com', 'married', 'employed', 'Civil Engineer', 115000, 'Denver', 'CO', '80202')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Curtis Maxwell 401(k)',  'Retirement', 280000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Maxwell Joint Brokerage','Brokerage',  130000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Maxwell Emergency Fund', 'Cash',        60000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-07-12', 'Annual Review', 'Building emergency fund to 6 months. Considering disability insurance.', v_advisor_name, ARRAY['Cash Management','Insurance'], 40);

  -- 23. Nielsen Family - $660k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Nielsen Family', 660000, 'Core', 'Active', 'Moderate', 'Self-employed; SEP IRA primary.', 170000, '2026-05-05')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Henrik', 'Nielsen', 'Primary', '1982-01-09', 'henrik@nielsenstrategy.com', 'married', 'self-employed', 'Strategy Consultant', 170000, 'Madison', 'WI', '53703')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Henrik Nielsen SEP IRA',     'Retirement', 410000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Nielsen Joint Brokerage',    'Brokerage',  185000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Nielsen HSA',                'HSA',         65000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-05-02', 'Annual Review', 'Strong consulting year. Maxed SEP at $66k. HSA invested aggressively.', v_advisor_name, ARRAY['Retirement Planning','Self-Employment'], 55);

  -- 24. Tan Family - $930k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Tan Family', 930000, 'Core', 'Active', 'Moderate', 'Empty nesters; ramp retirement savings.', 185000, '2026-10-26')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Maya', 'Tan', 'Primary', '1968-02-15', 'maya.tan@gmail.com', 'married', 'employed', 'HR Director', 130000, 'Cincinnati', 'OH', '45202', '2033-12-31')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Maya Tan 401(k)',     'Retirement', 540000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Tan Joint Brokerage', 'Brokerage',  290000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Tan IRA',             'Retirement', 100000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-10-23', 'Annual Review', 'Empty-nest savings boost — 401(k) catch-up max. Targeting age-65 retirement.', v_advisor_name, ARRAY['Retirement Planning'], 45);

  -- 25. Costa Family - $730k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Costa Family', 730000, 'Core', 'Active', 'Moderate', 'Two children; balanced retirement and college funding.', 180000, '2026-11-19')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Rafael', 'Costa', 'Primary', '1980-12-01', 'rafael.costa@gmail.com', 'married', 'employed', 'Accountant', 110000, 'Bellevue', 'WA', '98004')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Rafael Costa 401(k)',  'Retirement', 390000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Costa Joint Brokerage','Brokerage',  200000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Costa 529 (combined)', '529',        140000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-11-16', 'Annual Review', 'Kids 12 and 9. 529 on track for state-school costs.', v_advisor_name, ARRAY['Education Planning','Retirement Planning'], 45);

  -- 26. Levine Family - $590k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Levine Family', 590000, 'Core', 'Active', 'Moderate', 'Late 50s; rebuilding after divorce.', 135000, '2026-03-25')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Hannah', 'Levine', 'Primary', '1969-10-04', 'hannah.levine@gmail.com', 'divorced', 'employed', 'Communications Director', 135000, 'Cleveland', 'OH', '44102')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Hannah Levine 401(k)', 'Retirement', 360000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Levine Brokerage',     'Brokerage',  150000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Levine Roth IRA',      'Retirement',  80000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-03-22', 'Annual Review', 'Rebuilding well post-divorce. Maxing catch-up. Targeting retirement at 65.', v_advisor_name, ARRAY['Retirement Planning'], 45);

  -- 27. Pearson Family - $1.05M
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Pearson Family', 1050000, 'Core', 'Active', 'Moderate', 'Mid-50s; eyeing semi-retirement at 60.', 200000, '2026-06-21')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Trevor', 'Pearson', 'Primary', '1969-11-15', 'trevor.pearson@gmail.com', 'married', 'employed', 'Architect', 145000, 'Ann Arbor', 'MI', '48104')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Megan', 'Pearson', 'Spouse', '1971-05-04', 'married', 'employed', 55000, 'Ann Arbor', 'MI', '48104');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Trevor Pearson 401(k)',  'Retirement', 590000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Pearson Joint Brokerage','Brokerage',  310000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Pearson IRA',            'Retirement', 150000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-06-18', 'Annual Review', 'Semi-retirement plan: 25hr/wk at 60. Modeled income gap; bridge strategy in place.', v_advisor_name, ARRAY['Retirement Planning','Income Planning'], 60);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date)
    values (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Pearson semi-retirement bridge model', 'todo', 'medium', 'review', '2026-09-30');

  -- =========================================================================
  -- STANDARD TIER  (3 households, $0.92M)
  -- =========================================================================

  -- 28. Hoang Family - $300k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Hoang Family', 300000, 'Standard', 'Active', 'Aggressive', 'Young couple early in accumulation.', 130000, '2026-04-26')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Trang', 'Hoang', 'Primary', '1993-06-03', 'trang.hoang@gmail.com', 'married', 'employed', 'Software Developer', 130000, 'Austin', 'TX', '78704')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Trang Hoang 401(k)',     'Retirement', 200000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Hoang Joint Brokerage',  'Brokerage',   75000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Hoang Roth IRA',         'Retirement',  25000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-04-23', 'Annual Review', 'Great trajectory. Maxing 401(k) and Roth. Recently married — discussed first-home budget.', v_advisor_name, ARRAY['Retirement Planning','Real Estate'], 35);

  -- 29. Foster Family - $350k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Foster Family', 350000, 'Standard', 'Active', 'Moderate', 'Mid-30s; saving for kids and retirement.', 150000, '2026-09-08')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Owen', 'Foster', 'Primary', '1989-11-29', 'owen.foster@gmail.com', 'married', 'employed', 'Mechanical Engineer', 115000, 'Salt Lake City', 'UT', '84102')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Owen Foster 401(k)',    'Retirement', 220000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Foster Joint Brokerage','Brokerage',   90000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Foster 529',            '529',         40000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-09-05', 'Annual Review', 'Two young kids. Increased 529. Discussed term life and disability — referred for quotes.', v_advisor_name, ARRAY['Education Planning','Insurance'], 40);

  -- 30. Reyes Family - $270k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Reyes Family', 270000, 'Standard', 'Active', 'Aggressive', 'Late 20s; aggressive growth focus.', 100000, '2027-01-16')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Camila', 'Reyes', 'Primary', '1996-08-21', 'camila.reyes@gmail.com', 'single', 'employed', 'Product Designer', 100000, 'Brooklyn', 'NY', '11211')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Camila Reyes 401(k)', 'Retirement', 170000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Reyes Brokerage',     'Brokerage',   70000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Reyes Roth IRA',      'Retirement',  30000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2026-01-13', 'Annual Review', 'Strong saver. 100% equities given long horizon. Considered backdoor Roth — income too low to need it.', v_advisor_name, ARRAY['Retirement Planning'], 35);

  raise notice 'Seed complete. Created 30 households totaling ~$50M AUM for advisor %.', v_advisor_id;
end $$;

-- =========================================================================
-- AFTER RUNNING THIS SEED:
--
-- 1. Run scripts/seed_snapshots.sql with v_advisor_id = '92de3c6a-786a-460d-8704-94f7228be169'
--    to get 60 days of snapshot data backing the dashboard charts.
--
-- 2. (Optional) Adapt scripts/seed_aum_drops.sql and seed_tiers_and_pipeline.sql
--    for this advisor by swapping the UUID at the top.
--
-- 3. Sign in as this advisor and run the embeddings backfill from DevTools console:
--    for (const t of ['households','household_members','contact_accounts','compliance_notes','tasks','calendar_events']) {
--      const r = await supabase.functions.invoke('backfill-embeddings', { body: { table: t } });
--      console.log(t, r.data || r.error);
--    }
-- =========================================================================
