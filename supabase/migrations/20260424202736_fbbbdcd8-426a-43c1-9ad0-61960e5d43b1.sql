ALTER TABLE public.compliance_notes
ADD COLUMN contact_id uuid NULL REFERENCES public.household_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_notes_contact_id ON public.compliance_notes(contact_id);