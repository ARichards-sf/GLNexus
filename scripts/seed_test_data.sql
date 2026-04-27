-- =========================================================================
-- TEST DATA SEED — realistic advisor book of business, ~$50M total AUM
-- =========================================================================
--
-- HOW TO USE:
--   1. Paste your advisor user_id and firm_id into the two `DECLARE` lines
--      below (look for "PASTE_ADVISOR_USER_ID_HERE" and "PASTE_FIRM_ID_HERE").
--   2. Verify the advisor is already a member of the firm via
--      `firm_memberships` (this script does NOT create that membership).
--   3. Paste this whole file into Supabase Dashboard → SQL Editor → Run.
--      (Or run via psql if you have the DB password.)
--   4. After it succeeds, trigger embeddings backfill so Goodie can RAG it:
--      see notes at the bottom of this file.
--
-- DISTRIBUTION (~$49.98M total across 30 households):
--   Prime    (3) — $5M+         — $21.7M  (Anderson, Whitfield, Castellanos)
--   Premier (12) — $750k-$2.6M  — $18.9M
--   Core    (12) — $480k-$1.05M — $8.5M
--   Standard (3) — under $400k  — $0.9M
--
-- Each household includes 1–2 members (primary + spouse where applicable),
-- 2–4 accounts of varied types/institutions, 1–2 compliance notes covering
-- realistic conversations (annual reviews, life events, market discussions),
-- and 1 follow-up task. Prime-tier households also get 1 past + 1 upcoming
-- calendar event for richer scheduling test data.
-- =========================================================================

do $$
declare
  -- ── EDIT THESE TWO LINES ──────────────────────────────────────────────
  v_advisor_id uuid := 'PASTE_ADVISOR_USER_ID_HERE';
  v_firm_id    uuid := 'PASTE_FIRM_ID_HERE';
  -- ──────────────────────────────────────────────────────────────────────

  v_advisor_name text;
  v_hh_id  uuid;
  v_m1_id  uuid;
  v_m2_id  uuid;
begin
  -- Sanity check: confirm the advisor exists and belongs to that firm.
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
  -- PRIME TIER  (3 households, $21.7M)
  -- =========================================================================

  -- ── 1. Anderson Family — $7.0M, Greenwich CT, multi-gen wealth ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date, next_action, next_action_date)
  values (v_advisor_id, 'The Anderson Family', 7000000, 'Prime', 'Active', 'Conservative',
    'Multi-generational wealth preservation with modest growth. Tax-efficient income and trust planning.',
    850000, '2026-08-15', '2025-08-12', 'Coordinate with estate attorney on irrevocable trust funding', '2026-05-15')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, has_poa, has_healthcare_directive, primary_goal, address_line1, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'James', 'Anderson', 'Primary', '1962-04-12', 'james@andersongroup.com', '203-555-0101', 'married', 'employed', 'CEO', 'Anderson Industries LLC', 850000, true, true, true, true,
    'Transfer wealth to children while maintaining lifestyle in retirement', '142 Round Hill Rd', 'Greenwich', 'CT', '06831', '2027-12-31')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, has_will, has_trust, has_poa, has_healthcare_directive, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Margaret', 'Anderson', 'Spouse', '1964-09-23', 'margaret.anderson@gmail.com', '203-555-0102', 'married', 'retired', true, true, true, true, '142 Round Hill Rd', 'Greenwich', 'CT', '06831')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Anderson Trust - Brokerage',  'Trust',      4200000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'James Anderson 401(k)',        'Retirement', 1850000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'James Anderson Roth IRA',      'Retirement',  425000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m2_id, 'Margaret Anderson IRA',        'Retirement',  525000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-08-12', 'Annual Review',
     'Reviewed full portfolio with James and Margaret. Discussed 2025 market performance and confirmed conservative allocation aligns with retirement goals. Updated trust beneficiaries to include grandchildren via per stirpes. Next steps: coordinate with estate attorney on irrevocable trust funding by Q1 2026.',
     v_advisor_name, ARRAY['Portfolio Review','Estate Planning','Tax Planning'], 75),
    (v_advisor_id, v_hh_id, '2025-11-04', 'Phone Call',
     'James called regarding upcoming RMD. Walked through 2025 calculation: $86,500 total. Confirmed direct deposit to checking. Margaret deferring RMD start; setting up auto-distribution for 2026.',
     v_advisor_name, ARRAY['Tax Planning','Retirement Income'], 25);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, description, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Estate planning review with Anderson family',
     'Coordinate with their attorney on irrevocable trust funding. Send proposed structure by mid-May.', 'todo', 'high', 'meeting', '2026-05-15');

  insert into calendar_events (advisor_id, household_id, title, description, start_time, end_time, event_type, status) values
    (v_advisor_id, v_hh_id, 'Anderson Annual Review', 'Annual portfolio review and estate planning discussion',
     '2025-08-12 14:00:00+00', '2025-08-12 15:30:00+00', 'Annual Review', 'completed'),
    (v_advisor_id, v_hh_id, 'Anderson Estate Planning Meeting', 'Joint meeting with attorney to discuss trust restructuring',
     '2026-05-15 10:00:00+00', '2026-05-15 11:30:00+00', 'Meeting', 'scheduled');

  -- ── 2. Whitfield Family Trust — $8.2M, NYC, complex multi-gen ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date, next_action, next_action_date)
  values (v_advisor_id, 'The Whitfield Family Trust', 8200000, 'Prime', 'Active', 'Moderate',
    'Balanced growth with strong income generation. Educational funding for grandchildren and philanthropic giving.',
    1200000, '2026-06-20', '2025-06-18', 'Q1 charitable distribution review', '2026-03-31')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, has_poa, has_healthcare_directive, primary_goal, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Robert', 'Whitfield', 'Primary', '1957-02-08', 'r.whitfield@whitfieldlaw.com', '212-555-0203', 'married', 'employed', 'Senior Partner', 'Whitfield & Associates', 1200000, true, true, true, true,
    'Fund grandchildren education and establish family foundation', '420 Park Ave', 'New York', 'NY', '10022')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, has_will, has_trust, primary_goal, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Eleanor', 'Whitfield', 'Spouse', '1959-07-15', 'eleanor.w@gmail.com', '212-555-0204', 'married', 'retired', true, true,
    'Active in philanthropic boards; coordinate giving strategy', '420 Park Ave', 'New York', 'NY', '10022')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Whitfield Family Trust',          'Trust',      5400000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Robert Whitfield Brokerage',      'Brokerage',  1100000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Robert Whitfield 401(k)',          'Retirement',  900000, 'active', 'Fidelity'),
    (v_advisor_id, v_m2_id, 'Eleanor Whitfield IRA',            'Retirement',  600000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Whitfield Charitable DAF',         'Donor-Advised', 200000, 'active', 'Schwab Charitable');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-06-18', 'Annual Review',
     'Reviewed performance with Robert and Eleanor. Trust YTD up 9.2%, in line with target. Discussed 529 funding strategy for 4 grandchildren — agreed on $85k annual gift split across accounts. Eleanor wants to formalize family foundation in 2026; introduced estate attorney for foundation setup.',
     v_advisor_name, ARRAY['Portfolio Review','Estate Planning','Education Planning','Philanthropy'], 90),
    (v_advisor_id, v_hh_id, '2025-12-09', 'Email',
     'Robert emailed about year-end charitable contribution timing. Recommended $150k DAF contribution before 12/31 to maximize 2025 deduction. Confirmed wire from brokerage to Schwab Charitable on 12/15.',
     v_advisor_name, ARRAY['Tax Planning','Philanthropy'], NULL);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, description, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Whitfield Q1 charitable distribution review',
     'Review DAF balance, recommend grants, coordinate with Eleanor on board priorities.', 'todo', 'medium', 'review', '2026-03-31');

  insert into calendar_events (advisor_id, household_id, title, start_time, end_time, event_type, status) values
    (v_advisor_id, v_hh_id, 'Whitfield Annual Review', '2025-06-18 10:00:00+00', '2025-06-18 11:30:00+00', 'Annual Review', 'completed'),
    (v_advisor_id, v_hh_id, 'Whitfield Foundation Setup Discussion', '2026-04-22 14:00:00+00', '2026-04-22 15:00:00+00', 'Meeting', 'scheduled');

  -- ── 3. Castellanos Holdings — $6.5M, Miami FL, business owner ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date, next_action, next_action_date)
  values (v_advisor_id, 'The Castellanos Holdings', 6500000, 'Prime', 'Active', 'Aggressive',
    'Aggressive growth tilt; primary wealth from business. Concentration management and eventual liquidity event planning.',
    950000, '2026-10-05', '2025-10-03', 'Diversification proposal for concentrated stock position', '2026-04-10')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, primary_goal, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Carlos', 'Castellanos', 'Primary', '1971-11-30', 'carlos@castellanos-holdings.com', '305-555-0307', 'married', 'self-employed', 'Founder/CEO', 'Castellanos Holdings', 950000, true, false,
    'Diversify out of single-stock concentration ahead of potential exit in 3-5 years', '1455 Brickell Ave', 'Miami', 'FL', '33131')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, address_line1, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Sofia', 'Castellanos', 'Spouse', '1974-05-18', 'sofia.castellanos@gmail.com', '305-555-0308', 'married', 'employed', 'Pediatrician', '1455 Brickell Ave', 'Miami', 'FL', '33131')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Castellanos Concentrated Stock',  'Brokerage',  4100000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Castellanos Diversified Brokerage','Brokerage', 1200000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Carlos Solo 401(k)',              'Retirement',  650000, 'active', 'Vanguard'),
    (v_advisor_id, v_m2_id, 'Sofia Castellanos 403(b)',        'Retirement',  550000, 'active', 'TIAA');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-10-03', 'Annual Review',
     'Annual review with Carlos. Concentrated position now 63% of investable assets — risk concentration concern raised. Modeled 10b5-1 plan for systematic diversification over 24 months. Carlos wants to wait until potential M&A discussions resolve in Q2 2026 before committing. Sofia''s 403(b) up 11% YTD; on track for retirement at 60.',
     v_advisor_name, ARRAY['Portfolio Review','Risk Management','Concentration'], 80),
    (v_advisor_id, v_hh_id, '2026-01-22', 'Meeting',
     'In-person meeting at Brickell office. Carlos shared early M&A interest from strategic buyer. Discussed pre-transaction planning: QSBS analysis, charitable remainder trust options, installment sale structures. Engaged Castellanos''s attorney to begin diligence prep.',
     v_advisor_name, ARRAY['Tax Planning','Estate Planning','Business Owner'], 90);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, description, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Castellanos diversification proposal',
     'Build out 10b5-1 plan scenarios assuming M&A doesn''t close. Present at April meeting.', 'todo', 'high', 'review', '2026-04-10');

  insert into calendar_events (advisor_id, household_id, title, start_time, end_time, event_type, status) values
    (v_advisor_id, v_hh_id, 'Castellanos Diversification Strategy', '2026-04-10 15:00:00+00', '2026-04-10 16:30:00+00', 'Meeting', 'scheduled');

  -- =========================================================================
  -- PREMIER TIER  (12 households, $18.85M)
  -- =========================================================================

  -- ── 4. Brennan Family — $1.2M, Boston MA, dual-income professionals ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Brennan Family', 1200000, 'Premier', 'Active', 'Moderate',
    'Aggressive accumulation phase; college funding for two children and early-50s retirement target.', 385000, '2026-09-12', '2025-09-10')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Michael', 'Brennan', 'Primary', '1978-06-22', 'michael.brennan@bcgcorp.com', '617-555-0411', 'married', 'employed', 'Director', 'BCG Corporate', 220000, true, 'Retire by 55, fund kids'' college', 'Newton', 'MA', '02458')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, company, annual_income, has_will, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Sarah', 'Brennan', 'Spouse', '1980-03-14', 'sarah.brennan@masshospital.org', 'married', 'employed', 'Physician', 'Mass General Hospital', 165000, true, 'Newton', 'MA', '02458')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Michael Brennan 401(k)',     'Retirement', 425000, 'active', 'Fidelity'),
    (v_advisor_id, v_m2_id, 'Sarah Brennan 403(b)',       'Retirement', 380000, 'active', 'TIAA'),
    (v_advisor_id, v_m1_id, 'Brennan Joint Brokerage',    'Brokerage',  255000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Brennan 529 - Lily',         '529',         85000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Brennan 529 - Tyler',        '529',         55000, 'active', 'Fidelity');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-09-10', 'Annual Review',
     'Annual review with Michael and Sarah. Increased 529 contributions to $400/mo for both kids. Sarah promoted to attending — bumping 403(b) to max. Modeled retirement scenarios: 60/40 reasonable for "retire at 55, work part-time to 62" plan. Discussed term life increase to 20x income each.',
     v_advisor_name, ARRAY['Portfolio Review','Retirement Planning','Education Planning','Insurance'], 60);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Brennan term life quote follow-up', 'todo', 'medium', 'review', '2026-02-28');

  -- ── 5. Romero Family Trust — $2.0M, Austin TX, tech entrepreneur ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Romero Family Trust', 2000000, 'Premier', 'Active', 'Aggressive',
    'Growth tilt; recent liquidity event from tech exit. Tax planning around concentrated equity.', 280000, '2026-11-08', '2025-11-05')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, annual_income, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Diego', 'Romero', 'Primary', '1983-08-04', 'diego@romerolabs.io', '512-555-0508', 'married', 'self-employed', 'Founder', 280000, 'Use exit proceeds to launch second venture; fund Coastal home', 'Austin', 'TX', '78704')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Isabel', 'Romero', 'Spouse', '1985-11-19', 'married', 'homemaker', 'Austin', 'TX', '78704')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Romero Diversified Brokerage', 'Brokerage', 1450000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Romero SEP IRA',               'Retirement', 320000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m2_id, 'Isabel Romero IRA',            'Retirement', 145000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Romero Joint Cash Reserve',    'Cash',        85000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-11-05', 'Annual Review',
     'Diego completed sale of RomeroLabs in Q3. Reinvested $1.2M into diversified portfolio per pre-transaction plan. Discussed launching seed-stage fund with portion of proceeds — agreed to keep separate from financial planning portfolio. Recommended QSBS exclusion verification with CPA.',
     v_advisor_name, ARRAY['Liquidity Event','Tax Planning','Portfolio Review'], 70);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Romero QSBS verification with CPA', 'todo', 'high', 'review', '2026-03-15');

  -- ── 6. Patel Family — $1.5M, Princeton NJ, pre-retirees ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Patel Family', 1500000, 'Premier', 'Active', 'Moderate',
    'Pre-retirement transition; income generation focus and Roth conversion ladder.', 245000, '2026-05-22', '2025-05-19')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, primary_goal, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Raj', 'Patel', 'Primary', '1965-12-03', 'raj.patel@johnson.com', '609-555-0612', 'married', 'employed', 'VP Engineering', 'Johnson & Johnson', 245000, true, true, 'Retire at 65; live off portfolio for 30+ years', 'Princeton', 'NJ', '08540', '2030-12-31')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, job_title, has_will, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Priya', 'Patel', 'Spouse', '1968-04-25', 'married', 'employed', 'Pharmacist', true, 'Princeton', 'NJ', '08540')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Raj Patel 401(k)',          'Retirement', 720000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Raj Patel Rollover IRA',     'Retirement', 280000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m2_id, 'Priya Patel 401(k)',         'Retirement', 340000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Patel Joint Brokerage',     'Brokerage',  160000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-05-19', 'Annual Review',
     'Reviewed retirement readiness. 5 years out from Raj''s target retirement. Modeled Roth conversion ladder starting age 60 — convert $80k/yr through age 70 to optimize lifetime taxes. Priya considering reduced hours next year; updated cash flow plan accordingly.',
     v_advisor_name, ARRAY['Retirement Planning','Tax Planning','Roth Conversions'], 65);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Patel Roth conversion modeling', 'todo', 'medium', 'review', '2026-06-01');

  -- ── 7. O'Connor Estate — $2.4M, Chicago IL, retirees ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The O''Connor Estate', 2400000, 'Premier', 'Active', 'Conservative',
    'Retired couple; sustainable withdrawal strategy and legacy planning for two adult children.', 95000, '2026-04-18', '2025-04-15')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, has_will, has_trust, has_poa, has_healthcare_directive, primary_goal, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'William', 'O''Connor', 'Primary', '1955-09-17', 'bill.oconnor@gmail.com', '312-555-0719', 'married', 'retired', true, true, true, true, 'Maintain lifestyle through 95; legacy for kids', 'Wilmette', 'IL', '60091', '2020-06-30')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, has_will, has_trust, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Helen', 'O''Connor', 'Spouse', '1958-01-29', 'married', 'retired', true, true, 'Wilmette', 'IL', '60091', '2022-12-31')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'William O''Connor IRA',     'Retirement', 1300000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m2_id, 'Helen O''Connor IRA',       'Retirement',  640000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'O''Connor Joint Brokerage', 'Brokerage',   460000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-04-15', 'Annual Review',
     '5th year in retirement. Withdrawal rate 3.4%, well within sustainable range. Discussed long-term care insurance — Helen evaluating hybrid LTC policy. Reviewed beneficiary designations: updated to per stirpes after grandchild born.',
     v_advisor_name, ARRAY['Retirement Income','Insurance','Estate Planning'], 70);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'O''Connor LTC policy comparison', 'todo', 'medium', 'review', '2026-04-15');

  -- ── 8. Liu Family — $950k, Palo Alto CA, tech mid-career ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Liu Family', 950000, 'Premier', 'Active', 'Aggressive',
    'High-earning tech couple; RSU diversification and aggressive growth.', 520000, '2026-07-25', '2025-07-22')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Wei', 'Liu', 'Primary', '1986-02-11', 'wei.liu@meta.com', '650-555-0822', 'married', 'employed', 'Senior Engineering Manager', 'Meta', 320000, 'RSU diversification, home upgrade fund', 'Palo Alto', 'CA', '94301')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, job_title, company, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Mei', 'Liu', 'Spouse', '1988-06-30', 'married', 'employed', 'Product Manager', 'Stripe', 200000, 'Palo Alto', 'CA', '94301')
  returning id into v_m2_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Wei Liu 401(k)',           'Retirement', 380000, 'active', 'Fidelity'),
    (v_advisor_id, v_m2_id, 'Mei Liu 401(k)',           'Retirement', 245000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Liu Joint Brokerage',      'Brokerage',  185000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Liu Concentrated RSU',     'Brokerage',  140000, 'active', 'Morgan Stanley');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-07-22', 'Annual Review',
     'RSU concentration concern: Meta shares now 28% of investable assets. Set up systematic 10b5-1 sale plan: $15k/quarter through 2027 to reduce to under 10%. Wei expecting promotion early 2026; will reassess.',
     v_advisor_name, ARRAY['Concentration','Tax Planning','Portfolio Review'], 55);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Liu RSU sale Q1 confirmation', 'todo', 'medium', 'review', '2026-03-31');

  -- ── 9. Sullivan Family Trust — $1.7M, Philadelphia PA ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Sullivan Family Trust', 1700000, 'Premier', 'Active', 'Moderate',
    'Inherited wealth; preserving and growing for next generation.', 215000, '2026-03-30', '2025-03-28')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, has_trust, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Patrick', 'Sullivan', 'Primary', '1972-10-08', 'patrick.s@upenn.edu', 'married', 'employed', 'Professor', true, 'Honor parents'' legacy; fund nieces'' education', 'Bryn Mawr', 'PA', '19010')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Catherine', 'Sullivan', 'Spouse', '1974-04-16', 'married', 'employed', 'Bryn Mawr', 'PA', '19010');

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Sullivan Family Trust',     'Trust',     1100000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Patrick Sullivan 403(b)',   'Retirement', 360000, 'active', 'TIAA'),
    (v_advisor_id, v_m1_id, 'Sullivan Joint Brokerage',  'Brokerage',  240000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-03-28', 'Annual Review',
     'Trust performance steady at 7.1% CAGR over 3 years. Confirmed 529 funding for 3 nieces — $50k each opened. Patrick considering early retirement at 60; modeled scenarios.',
     v_advisor_name, ARRAY['Portfolio Review','Education Planning','Retirement Planning'], 60);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Sullivan early-retirement scenario refresh', 'todo', 'low', 'review', '2026-08-31');

  -- ── 10. Grayson Family — $2.6M, Westport CT ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Grayson Family', 2600000, 'Premier', 'Active', 'Moderate',
    'Two children, both in college; balanced approach with college funding wind-down.', 410000, '2026-09-05', '2025-09-02')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Jonathan', 'Grayson', 'Primary', '1974-05-21', 'jon.grayson@morganstanley.com', '203-555-0934', 'married', 'employed', 'Managing Director', 'Morgan Stanley', 410000, true, 'Fund kids'' grad school, target retirement at 60', 'Westport', 'CT', '06880')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, job_title, has_will, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Emily', 'Grayson', 'Spouse', '1976-09-08', 'married', 'employed', 'Marketing Director', true, 'Westport', 'CT', '06880');

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Jonathan Grayson 401(k)',  'Retirement',  920000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Grayson Joint Brokerage',  'Brokerage',  1100000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Grayson 529 - Hannah',     '529',         180000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Grayson 529 - Andrew',     '529',         145000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Jonathan Grayson IRA',     'Retirement',  255000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-09-02', 'Annual Review',
     'Hannah entering junior year, Andrew freshman. 529 drawdown plan working well; should sustain through both undergrads. Discussed potential grad school funding — increased 529 contributions to $24k combined for tax-free growth window.',
     v_advisor_name, ARRAY['Education Planning','Portfolio Review'], 65);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Grayson tax loss harvesting review', 'todo', 'medium', 'review', '2026-11-15');

  -- ── 11. Nakamura Trust — $1.3M, San Diego CA ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Nakamura Trust', 1300000, 'Premier', 'Active', 'Moderate',
    'Single professional managing inherited trust plus own savings.', 195000, '2026-08-08', '2025-08-05')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, company, annual_income, has_will, has_trust, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Kenji', 'Nakamura', 'Primary', '1980-03-04', 'k.nakamura@scripps.edu', '858-555-1037', 'single', 'employed', 'Research Scientist', 'Scripps Institute', 195000, true, true, 'Maintain inherited trust integrity, build personal nest egg', 'La Jolla', 'CA', '92037')
  returning id into v_m1_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Nakamura Inherited Trust',  'Trust',      720000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Kenji Nakamura 403(b)',     'Retirement', 410000, 'active', 'TIAA'),
    (v_advisor_id, v_m1_id, 'Kenji Nakamura Brokerage',  'Brokerage',  170000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-08-05', 'Annual Review',
     'Trust performing well, distributions covering Kenji''s home down payment goal. Personal investments tilted slightly more aggressive given long horizon. Discussed I-bond ladder for emergency reserves.',
     v_advisor_name, ARRAY['Portfolio Review','Cash Management'], 50);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Nakamura I-bond ladder setup', 'todo', 'low', 'admin', '2026-04-30');

  -- ── 12. Vasquez Family — $1.6M, San Antonio TX ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Vasquez Family', 1600000, 'Premier', 'Active', 'Moderate',
    'Mid-career; military pension plus civilian income, college funding for 3 kids.', 235000, '2026-06-12', '2025-06-09')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, primary_goal, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Miguel', 'Vasquez', 'Primary', '1976-07-12', 'miguel.vasquez@usaa.com', 'married', 'employed', 'Cybersecurity Director', 165000, 'Retire from civilian work at 62, lean on military pension', 'San Antonio', 'TX', '78230', '2038-12-31')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Adriana', 'Vasquez', 'Spouse', '1978-12-22', 'married', 'employed', 'Teacher', 70000, 'San Antonio', 'TX', '78230');

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Miguel Vasquez TSP',           'Retirement', 480000, 'active', 'Federal TSP'),
    (v_advisor_id, v_m1_id, 'Miguel Vasquez 401(k)',         'Retirement', 510000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Vasquez Joint Brokerage',       'Brokerage',  395000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Vasquez 529 (combined)',        '529',        215000, 'active', 'Fidelity');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-06-09', 'Annual Review',
     'Reviewed transition from military to civilian career — 3 years in. TSP rolled into IRA last year; 401(k) building well. Three kids ages 8, 12, 14: 529 on track but college costs concerning. Modeled state-school vs private scenarios.',
     v_advisor_name, ARRAY['Retirement Planning','Education Planning','Pension Income'], 70);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Vasquez college cost stress test', 'todo', 'medium', 'review', '2026-06-30');

  -- ── 13. Henderson Estate — $2.0M, Denver CO ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Henderson Estate', 2000000, 'Premier', 'Active', 'Conservative',
    'Recent widow managing inherited estate; income focus and wealth preservation.', 65000, '2026-02-10', '2025-02-08')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, has_will, has_trust, has_poa, has_healthcare_directive, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Patricia', 'Henderson', 'Primary', '1953-04-18', 'patricia.h@gmail.com', '303-555-1142', 'widowed', 'retired', true, true, true, true, 'Stable income through life; legacy for 3 children', 'Denver', 'CO', '80202')
  returning id into v_m1_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Henderson Inherited IRA',       'Retirement', 1100000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Henderson Joint -> Survivor',   'Brokerage',   650000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Henderson Cash Reserve',        'Cash',        250000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-02-08', 'Annual Review',
     'First full year managing estate post-husband''s passing. Patricia comfortable with income strategy: $4,500/mo from portfolio plus Social Security. RMD on inherited IRA scheduled. Reviewed beneficiaries — 3 children equally.',
     v_advisor_name, ARRAY['Retirement Income','Estate Planning','Bereavement'], 75);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Henderson 2026 RMD calculation', 'todo', 'high', 'admin', '2026-12-15');

  -- ── 14. Williamson Trust — $850k, Tampa FL ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Williamson Trust', 850000, 'Premier', 'Active', 'Moderate',
    'Recently retired teacher couple; pension income plus portfolio for travel and gifts.', 85000, '2026-01-25', '2025-01-22')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, has_will, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'David', 'Williamson', 'Primary', '1959-08-15', 'd.williamson@yahoo.com', 'married', 'retired', true, 'Travel comfortably; help grandkids with college', 'Tampa', 'FL', '33602')
  returning id into v_m1_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, has_will, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Linda', 'Williamson', 'Spouse', '1961-11-09', 'married', 'retired', true, 'Tampa', 'FL', '33602');

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Williamson 403(b) Rollover',  'Retirement', 480000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Williamson Joint Brokerage',  'Brokerage',  280000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Williamson Cash',             'Cash',        90000, 'active', 'LPL Financial');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-01-22', 'Annual Review',
     'Retired 2 years. Pension covers fixed expenses; portfolio supplements discretionary spending (travel, grandkid gifts). 4% withdrawal sustainable. Discussed 529 funding for 4 grandkids: $5k each annually.',
     v_advisor_name, ARRAY['Retirement Income','Education Planning'], 55);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Williamson 529 grandkid setup', 'todo', 'low', 'admin', '2026-05-31');

  -- ── 15. Adler Family — $750k, Long Island NY ──
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date, last_review_date)
  values (v_advisor_id, 'The Adler Family', 750000, 'Premier', 'Active', 'Moderate',
    'Single mom; survivor benefits and inherited assets supporting two minor children.', 75000, '2026-10-30', '2025-10-28')
  returning id into v_hh_id;

  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, phone, marital_status, employment_status, job_title, annual_income, has_will, has_trust, primary_goal, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Rachel', 'Adler', 'Primary', '1985-06-04', 'rachel.adler@nslij.org', '516-555-1247', 'widowed', 'employed', 'Nurse Practitioner', 95000, true, true, 'Stable income for kids; college funding', 'Garden City', 'NY', '11530')
  returning id into v_m1_id;

  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Adler Survivor Benefit IRA',   'Retirement', 380000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Adler Joint Brokerage',        'Brokerage',  185000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Adler 529 - Sam',              '529',         95000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Adler 529 - Olivia',           '529',         70000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Adler 401(k)',                 'Retirement',  20000, 'active', 'Fidelity');

  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-10-28', 'Annual Review',
     'Rachel doing well 4 years post-loss. Survivor benefits providing solid base. 529 funding on track for both kids — Sam (12) and Olivia (9). Considering returning to grad school; modeled scenarios with reduced income year.',
     v_advisor_name, ARRAY['Retirement Planning','Education Planning','Insurance'], 65);

  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date) values
    (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Adler grad school scenario modeling', 'todo', 'medium', 'review', '2026-08-31');

  -- =========================================================================
  -- CORE TIER  (12 households, $8.54M)
  -- =========================================================================

  -- ── 16-27. Core households (compact format) ──

  -- 16. Bennett Family - $620k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Bennett Family', 620000, 'Core', 'Active', 'Moderate',
    'Mid-career professionals; balanced portfolio with retirement focus.', 145000, '2026-05-08')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Marcus', 'Bennett', 'Primary', '1982-04-15', 'marcus.bennett@gmail.com', 'married', 'employed', 'Software Engineer', 145000, 'Seattle', 'WA', '98101')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Marcus Bennett 401(k)', 'Retirement', 380000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Bennett Joint Brokerage', 'Brokerage', 180000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Bennett Roth IRA', 'Retirement', 60000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-05-06', 'Annual Review', 'Reviewed allocation, increased 401(k) to max. On track for age 60 retirement.', v_advisor_name, ARRAY['Portfolio Review','Retirement Planning'], 45);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date)
    values (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Bennett quarterly check-in', 'todo', 'low', 'review', '2026-08-08');

  -- 17. Coleman Family - $880k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Coleman Family', 880000, 'Core', 'Active', 'Moderate', 'Pre-retirement, conservative shift in next 3 years.', 175000, '2026-04-22')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Susan', 'Coleman', 'Primary', '1962-08-07', 'susan.coleman@nyu.edu', 'married', 'employed', 'University Administrator', 105000, 'Brooklyn', 'NY', '11215', '2029-06-30')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Robert', 'Coleman', 'Spouse', '1960-01-25', 'married', 'employed', 70000, 'Brooklyn', 'NY', '11215');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Susan Coleman 403(b)', 'Retirement', 510000, 'active', 'TIAA'),
    (v_advisor_id, v_m1_id, 'Coleman Joint Brokerage', 'Brokerage', 220000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Coleman Cash Reserve', 'Cash', 150000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-04-20', 'Annual Review', 'Glide path discussion: shift to 50/50 over next 36 months. Discussed Social Security claiming strategy at 67 vs 70.', v_advisor_name, ARRAY['Retirement Planning','Glide Path'], 50);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date)
    values (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Coleman SS claiming analysis', 'todo', 'medium', 'review', '2026-05-31');

  -- 18. Davis Trust - $510k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Davis Trust', 510000, 'Core', 'Active', 'Conservative', 'Trust beneficiary; income-focused.', 55000, '2026-03-15')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, has_trust, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Thomas', 'Davis', 'Primary', '1968-09-22', 'tom.davis@gmail.com', 'single', 'employed', 'Graphic Designer', 55000, true, 'Portland', 'OR', '97201')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Davis Inherited Trust', 'Trust', 380000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Thomas Davis IRA', 'Retirement', 130000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-03-13', 'Annual Review', 'Trust providing $1,200/mo distribution. Tom continues building IRA. No major changes.', v_advisor_name, ARRAY['Portfolio Review'], 35);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date)
    values (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Davis annual rebalance', 'todo', 'low', 'admin', '2026-09-30');

  -- 19. Ellis Family - $740k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Ellis Family', 740000, 'Core', 'Active', 'Moderate', 'Mid-career; new home purchase planning.', 165000, '2026-07-18')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Brandon', 'Ellis', 'Primary', '1984-11-30', 'brandon.ellis@gmail.com', 'married', 'employed', 'Sales Manager', 95000, 'Atlanta', 'GA', '30309')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Ellis 401(k)', 'Retirement', 410000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Ellis Joint Brokerage', 'Brokerage', 215000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Ellis Home Down Payment Fund', 'Cash', 115000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-07-15', 'Annual Review', 'Home purchase timeline 12-18 months out. Down payment in T-bills and HYSA. Discussed mortgage rate environment.', v_advisor_name, ARRAY['Cash Management','Real Estate'], 50);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date)
    values (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Ellis home purchase readiness check', 'todo', 'medium', 'review', '2026-04-15');

  -- 20. Fitzgerald Family - $830k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Fitzgerald Family', 830000, 'Core', 'Active', 'Moderate', 'Two-earner family with one child; balanced approach.', 195000, '2026-08-25')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Sean', 'Fitzgerald', 'Primary', '1979-02-08', 'sean.fitz@gmail.com', 'married', 'employed', 'Operations Manager', 115000, 'Minneapolis', 'MN', '55401')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Sean Fitzgerald 401(k)', 'Retirement', 480000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Fitzgerald Joint Brokerage', 'Brokerage', 230000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Fitzgerald 529', '529', 120000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-08-23', 'Annual Review', 'Steady progress. Daughter starting middle school; continuing $400/mo into 529.', v_advisor_name, ARRAY['Education Planning','Retirement Planning'], 40);

  -- 21. Gomez Family - $560k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Gomez Family', 560000, 'Core', 'Active', 'Moderate', 'Mid-career; aggressive accumulation.', 135000, '2026-11-12')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Ana', 'Gomez', 'Primary', '1986-05-19', 'ana.gomez@gmail.com', 'married', 'employed', 'Project Manager', 135000, 'Phoenix', 'AZ', '85001')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Ana Gomez 401(k)', 'Retirement', 320000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Gomez Joint Brokerage', 'Brokerage', 165000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Gomez Roth IRA', 'Retirement', 75000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-11-10', 'Annual Review', 'On track. Ana increased Roth backdoor contributions. Newly married 2024; updated beneficiaries.', v_advisor_name, ARRAY['Retirement Planning','Tax Planning'], 45);

  -- 22. Harris Family - $480k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Harris Family', 480000, 'Core', 'Active', 'Moderate', 'Building emergency reserves and retirement.', 110000, '2026-06-05')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Tyler', 'Harris', 'Primary', '1989-09-14', 'tyler.harris@gmail.com', 'married', 'employed', 'Civil Engineer', 110000, 'Charlotte', 'NC', '28202')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Tyler Harris 401(k)', 'Retirement', 285000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Harris Joint Brokerage', 'Brokerage', 130000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Harris Emergency Fund', 'Cash', 65000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-06-03', 'Annual Review', 'Building emergency fund to 6 months. Considering disability insurance — referred to specialist.', v_advisor_name, ARRAY['Cash Management','Insurance'], 40);

  -- 23. Iverson Family - $650k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Iverson Family', 650000, 'Core', 'Active', 'Moderate', 'Self-employed; SEP IRA primary vehicle.', 165000, '2026-03-28')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Erik', 'Iverson', 'Primary', '1981-12-02', 'erik@iversonconsulting.net', 'married', 'self-employed', 'Consultant', 165000, 'Madison', 'WI', '53703')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Erik Iverson SEP IRA', 'Retirement', 410000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Iverson Joint Brokerage', 'Brokerage', 180000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Iverson HSA', 'HSA', 60000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-03-26', 'Annual Review', 'Strong year for consulting. Maxed SEP at $66k. HSA invested aggressively.', v_advisor_name, ARRAY['Retirement Planning','Tax Planning','Self-Employment'], 55);

  -- 24. Johnson Family - $920k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Johnson Family', 920000, 'Core', 'Active', 'Moderate', 'Empty nesters; ramp up retirement savings.', 180000, '2026-09-19')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code, retirement_date)
  values (v_advisor_id, v_hh_id, 'Karen', 'Johnson', 'Primary', '1966-07-11', 'karen.johnson@gmail.com', 'married', 'employed', 'HR Director', 130000, 'Cincinnati', 'OH', '45202', '2031-12-31')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Karen Johnson 401(k)', 'Retirement', 540000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Johnson Joint Brokerage', 'Brokerage', 280000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Johnson IRA', 'Retirement', 100000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-09-17', 'Annual Review', 'Empty nest savings boost — increased 401(k) to catch-up max. Targeting age 65 retirement.', v_advisor_name, ARRAY['Retirement Planning'], 45);

  -- 25. Kim Family - $720k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Kim Family', 720000, 'Core', 'Active', 'Moderate', 'Two children; balanced retirement and college funding.', 175000, '2026-10-08')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'David', 'Kim', 'Primary', '1979-04-23', 'david.kim@gmail.com', 'married', 'employed', 'Accountant', 105000, 'Bellevue', 'WA', '98004')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'David Kim 401(k)', 'Retirement', 380000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Kim Joint Brokerage', 'Brokerage', 195000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Kim 529 (combined)', '529', 145000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-10-06', 'Annual Review', 'Kids 13 and 10. 529s on track for state-school costs. Considered Coverdell — decided 529 simpler.', v_advisor_name, ARRAY['Education Planning','Retirement Planning'], 45);

  -- 26. Levin Family - $580k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Levin Family', 580000, 'Core', 'Active', 'Moderate', 'Late 50s; rebuilding after divorce 5 years ago.', 130000, '2026-02-22')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Rebecca', 'Levin', 'Primary', '1968-03-30', 'rebecca.levin@gmail.com', 'divorced', 'employed', 'Marketing Director', 130000, 'Cleveland', 'OH', '44102')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Rebecca Levin 401(k)', 'Retirement', 350000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Levin Brokerage', 'Brokerage', 145000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Levin Roth IRA', 'Retirement', 85000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-02-20', 'Annual Review', 'Rebuilding well post-divorce. Maxing catch-up contributions. Targeting retirement at 65.', v_advisor_name, ARRAY['Retirement Planning'], 45);

  -- 27. Mitchell Family - $1.05M
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Mitchell Family', 1050000, 'Core', 'Active', 'Moderate', 'Mid-50s; eyeing semi-retirement at 60.', 195000, '2026-05-30')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Gregory', 'Mitchell', 'Primary', '1968-10-17', 'g.mitchell@gmail.com', 'married', 'employed', 'Architect', 145000, 'Ann Arbor', 'MI', '48104')
  returning id into v_m1_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, marital_status, employment_status, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Diane', 'Mitchell', 'Spouse', '1970-04-29', 'married', 'employed', 50000, 'Ann Arbor', 'MI', '48104');
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Gregory Mitchell 401(k)', 'Retirement', 580000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Mitchell Joint Brokerage', 'Brokerage', 320000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Mitchell IRA', 'Retirement', 150000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-05-28', 'Annual Review', 'Semi-retirement plan: dial back to 25hr/wk at 60. Modeled income gap; discussed bridge strategy.', v_advisor_name, ARRAY['Retirement Planning','Income Planning'], 60);
  insert into tasks (advisor_id, assigned_to, created_by, household_id, title, status, priority, task_type, due_date)
    values (v_advisor_id, v_advisor_id, v_advisor_id, v_hh_id, 'Mitchell semi-retirement bridge model', 'todo', 'medium', 'review', '2026-09-30');

  -- =========================================================================
  -- STANDARD TIER  (3 households, $0.89M)
  -- =========================================================================

  -- 28. Nguyen Family - $290k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Nguyen Family', 290000, 'Standard', 'Active', 'Aggressive', 'Young couple early in accumulation.', 125000, '2026-04-04')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Linh', 'Nguyen', 'Primary', '1992-08-25', 'linh.nguyen@gmail.com', 'married', 'employed', 'Software Developer', 125000, 'Austin', 'TX', '78704')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Linh Nguyen 401(k)', 'Retirement', 195000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Nguyen Joint Brokerage', 'Brokerage', 70000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Nguyen Roth IRA', 'Retirement', 25000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-04-02', 'Annual Review', 'On a great trajectory. Maxing 401(k) and Roth. Just married — discussed budget for first home.', v_advisor_name, ARRAY['Retirement Planning','Real Estate'], 35);

  -- 29. Olsen Family - $340k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Olsen Family', 340000, 'Standard', 'Active', 'Moderate', 'Mid-30s; saving for kids and retirement.', 145000, '2026-08-12')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Erik', 'Olsen', 'Primary', '1989-12-08', 'erik.olsen@gmail.com', 'married', 'employed', 'Mechanical Engineer', 110000, 'Salt Lake City', 'UT', '84102')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Erik Olsen 401(k)', 'Retirement', 215000, 'active', 'Vanguard'),
    (v_advisor_id, v_m1_id, 'Olsen Joint Brokerage', 'Brokerage', 85000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Olsen 529', '529', 40000, 'active', 'Fidelity');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-08-10', 'Annual Review', 'Two young kids. Increased 529 contributions. Discussed term life and disability — referred for quotes.', v_advisor_name, ARRAY['Education Planning','Insurance'], 40);

  -- 30. Park Family - $260k
  insert into households (advisor_id, name, total_aum, wealth_tier, status, risk_tolerance, investment_objective, annual_income, annual_review_date)
  values (v_advisor_id, 'The Park Family', 260000, 'Standard', 'Active', 'Aggressive', 'Late 20s; aggressive growth focus.', 95000, '2026-12-08')
  returning id into v_hh_id;
  insert into household_members (advisor_id, household_id, first_name, last_name, relationship, date_of_birth, email, marital_status, employment_status, job_title, annual_income, city, state, zip_code)
  values (v_advisor_id, v_hh_id, 'Jessica', 'Park', 'Primary', '1995-02-17', 'jessica.park@gmail.com', 'single', 'employed', 'UX Designer', 95000, 'Brooklyn', 'NY', '11211')
  returning id into v_m1_id;
  insert into contact_accounts (advisor_id, member_id, account_name, account_type, balance, status, institution) values
    (v_advisor_id, v_m1_id, 'Jessica Park 401(k)', 'Retirement', 165000, 'active', 'Fidelity'),
    (v_advisor_id, v_m1_id, 'Park Brokerage', 'Brokerage', 65000, 'active', 'LPL Financial'),
    (v_advisor_id, v_m1_id, 'Park Roth IRA', 'Retirement', 30000, 'active', 'LPL Financial');
  insert into compliance_notes (advisor_id, household_id, date, type, summary, advisor_name, pillars_covered, meeting_duration_minutes) values
    (v_advisor_id, v_hh_id, '2025-12-06', 'Annual Review', 'Strong saver. 100% equities given long horizon. Considered backdoor Roth — income too low to need it.', v_advisor_name, ARRAY['Retirement Planning'], 35);

  raise notice 'Seed complete. Created 30 households totaling ~$50M AUM for advisor %.', v_advisor_id;
end $$;

-- =========================================================================
-- AFTER RUNNING THIS SEED:
--
-- Embeddings won't auto-populate because INSERTs bypass the FE hooks. To make
-- Goodie's RAG retrieval see this data, sign in as the advisor and run the
-- following in your browser console (DevTools → Console):
--
--   for (const t of ['households','household_members','contact_accounts','compliance_notes','tasks','calendar_events']) {
--     const r = await window.supabase.functions.invoke('backfill-embeddings', { body: { table: t } });
--     console.log(t, r);
--   }
--
-- (You may need to expose `supabase` on `window` in development, or copy the
-- existing supabase client import. Alternatively, hit any household profile
-- page and trigger any update — the FE hook will embed that one record.)
-- =========================================================================
