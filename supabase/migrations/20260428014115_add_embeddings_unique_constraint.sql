-- Add the UNIQUE (record_id, table_name) constraint that embed-record and
-- backfill-embeddings have been depending on the entire time.
--
-- Both functions call:
--   .upsert({...}, { onConflict: "record_id,table_name" })
--
-- Without a matching UNIQUE constraint, every upsert silently fails with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" — and because the original embed-record function ignored
-- the upsert error, the embeddings table stayed empty while functions
-- reported success. Adding the constraint makes ON CONFLICT work, which
-- in turn makes embeddings actually persist.
--
-- The table is currently empty (every prior insert failed), so adding a
-- UNIQUE constraint can't violate existing data.

alter table public.embeddings
  add constraint embeddings_record_table_uq unique (record_id, table_name);
