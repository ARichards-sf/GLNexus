-- Restore base privileges for the `service_role` on the `public` schema.
-- Companion to 20260427021846_restore_authenticated_grants.sql — same root cause
-- (this project was bootstrapped without the default Supabase grants), but the
-- previous migration only fixed the `authenticated` role. Edge functions that
-- use the service-role key were still being denied (`42501`), so verifyAdmin in
-- admin-operations was failing for every caller.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
