-- Drop the old single contact_id column
ALTER TABLE public.compliance_notes DROP COLUMN IF EXISTS contact_id;

-- Create junction table
CREATE TABLE public.compliance_note_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_note_id uuid NOT NULL REFERENCES public.compliance_notes(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (compliance_note_id, contact_id)
);

-- Indexes
CREATE INDEX idx_cnc_note ON public.compliance_note_contacts(compliance_note_id);
CREATE INDEX idx_cnc_contact ON public.compliance_note_contacts(contact_id);

-- Enable RLS
ALTER TABLE public.compliance_note_contacts ENABLE ROW LEVEL SECURITY;

-- Policies: gate via parent compliance_notes ownership
CREATE POLICY "Advisors can view their note contact links"
ON public.compliance_note_contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_notes cn
    WHERE cn.id = compliance_note_contacts.compliance_note_id
      AND (cn.advisor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_gl_internal(auth.uid()))
  )
);

CREATE POLICY "Advisors can insert their note contact links"
ON public.compliance_note_contacts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compliance_notes cn
    WHERE cn.id = compliance_note_contacts.compliance_note_id
      AND cn.advisor_id = auth.uid()
  )
);

CREATE POLICY "Advisors can delete their note contact links"
ON public.compliance_note_contacts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_notes cn
    WHERE cn.id = compliance_note_contacts.compliance_note_id
      AND cn.advisor_id = auth.uid()
  )
);