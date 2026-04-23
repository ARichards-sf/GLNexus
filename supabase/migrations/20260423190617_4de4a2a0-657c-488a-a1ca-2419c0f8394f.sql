CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  advisor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX embeddings_embedding_idx
ON public.embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX embeddings_advisor_table_idx
ON public.embeddings (advisor_id, table_name);

CREATE INDEX embeddings_record_table_idx
ON public.embeddings (record_id, table_name);

ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advisors_own_embeddings"
ON public.embeddings
FOR ALL TO authenticated
USING (advisor_id = auth.uid())
WITH CHECK (advisor_id = auth.uid());

CREATE POLICY "gl_internal_read_embeddings"
ON public.embeddings
FOR SELECT TO authenticated
USING (public.is_gl_internal(auth.uid()));

CREATE TRIGGER update_embeddings_updated_at
BEFORE UPDATE ON public.embeddings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();