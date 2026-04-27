-- Add tables to the `supabase_realtime` publication so the FE realtime
-- subscriptions in useRealtimeRefresh and useRequestMessages actually fire.
--
-- In a fresh Supabase project the publication exists but is empty by
-- default. Each table needs to be added explicitly. Without this, the
-- FE channel.subscribe() succeeds but no events ever arrive.
--
-- Also set REPLICA IDENTITY FULL on each so UPDATE/DELETE events include
-- the full row payload (otherwise only the primary key is sent, which
-- is fine for INSERT but loses prior column values for diffs).
--
-- Idempotent — guards against re-add via pg_publication_tables lookup.

do $$
declare
  t text;
  tables text[] := array[
    'households',
    'compliance_notes',
    'calendar_events',
    'contact_accounts',
    'service_request_messages'
  ];
begin
  foreach t in array tables loop
    -- Set REPLICA IDENTITY FULL (idempotent — Postgres no-ops if already set).
    execute format('alter table public.%I replica identity full', t);

    -- Add to publication only if missing.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'Added % to supabase_realtime', t;
    else
      raise notice 'Table % already in supabase_realtime — skipping', t;
    end if;
  end loop;
end $$;
