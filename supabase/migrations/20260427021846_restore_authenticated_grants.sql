-- Restore base privileges for the `authenticated` role on the `public` schema.
-- These should normally be present by default in a Supabase project but were
-- missing in this project after migration from a previous Supabase instance,
-- causing every signed-in query to fail with `42501: permission denied`.
--
-- RLS policies still gate row-level access; these grants only allow the
-- statements to be evaluated against RLS in the first place.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
