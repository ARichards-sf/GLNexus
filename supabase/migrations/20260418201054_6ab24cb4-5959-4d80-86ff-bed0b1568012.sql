CREATE TABLE public.deletion_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  advisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deletion_reason TEXT NOT NULL,
  record_snapshot JSONB NOT NULL,
  deleted_by TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gl_admin_read_audit_log"
ON public.deletion_audit_log
FOR SELECT
TO authenticated
USING (public.is_gl_internal(auth.uid()));

CREATE INDEX idx_audit_log_type_date
  ON public.deletion_audit_log(record_type, deleted_at);

CREATE INDEX idx_audit_log_advisor
  ON public.deletion_audit_log(advisor_id, deleted_at);