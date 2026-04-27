-- Catch up `profiles` to the columns the FE/types.ts expect.
--
-- Same pattern as the household_members catchup migration: the old
-- Supabase project added these via the dashboard without writing
-- migrations, so the GL Nexus rebuild is missing them and queries from
-- useDashboardLayout / scorecard / Goodie disclosure flow throw
-- `42703 column does not exist`.

alter table public.profiles
  add column if not exists dashboard_layout jsonb,
  add column if not exists scorecard_settings jsonb,
  add column if not exists goodie_disclosure_accepted boolean not null default false,
  add column if not exists goodie_disclosure_date timestamptz;
