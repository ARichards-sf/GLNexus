-- Add the `match_embeddings` RPC that `ai-chat` uses for RAG retrieval.
--
-- This was missing in the source migrations (likely lived only in the old
-- project's manual SQL setup). Without it, the edge function's
-- `supabaseAdmin.rpc("match_embeddings", ...)` silently errors and the chat
-- runs with no record context.
--
-- The vector extension lives in the `extensions` schema (see migration
-- 20260423190635), so the parameter type and operator are explicitly
-- namespaced.

create or replace function public.match_embeddings(
  query_embedding extensions.vector(1536),
  match_advisor_id uuid,
  match_count int default 5,
  filter_table text default null
)
returns table (
  id uuid,
  record_id uuid,
  table_name text,
  content text,
  similarity double precision,
  metadata jsonb
)
language sql
stable
as $$
  select
    e.id,
    e.record_id,
    e.table_name,
    e.content,
    (1 - (e.embedding operator(extensions.<=>) query_embedding))::double precision as similarity,
    e.metadata
  from public.embeddings e
  where e.advisor_id = match_advisor_id
    and (filter_table is null or e.table_name = filter_table)
    and e.embedding is not null
  order by e.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;
