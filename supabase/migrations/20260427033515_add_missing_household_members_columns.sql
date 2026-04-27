-- Catch up `household_members` to the columns the FE/types.ts expect.
--
-- When migrating from the old Supabase project, many ALTER TABLE statements
-- never made it into the migration files (they were added via the dashboard).
-- This migration adds those columns so the live schema matches what the app
-- is already coded against. All are nullable / non-breaking; existing rows
-- get NULL defaults.

alter table public.household_members
  add column if not exists middle_name text,
  add column if not exists preferred_name text,
  add column if not exists marital_status text,
  add column if not exists employment_status text,
  add column if not exists annual_income numeric,
  add column if not exists net_worth numeric,
  add column if not exists liquid_net_worth numeric,
  add column if not exists primary_goal text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text,
  add column if not exists country text,
  add column if not exists retirement_date date,
  add column if not exists mobile_phone text,
  add column if not exists secondary_phone text,
  add column if not exists secondary_email text,
  add column if not exists ssn text,
  add column if not exists ssn_last_four text,
  add column if not exists has_will boolean,
  add column if not exists has_trust boolean,
  add column if not exists has_poa boolean,
  add column if not exists has_healthcare_directive boolean,
  add column if not exists beneficiary_review_date date,
  add column if not exists preferred_contact text,
  add column if not exists accountant text,
  add column if not exists accountant_phone text,
  add column if not exists estate_attorney text,
  add column if not exists estate_attorney_phone text,
  add column if not exists filing_status text,
  add column if not exists tax_bracket text,
  add column if not exists number_of_dependents integer,
  add column if not exists years_to_retirement integer;
