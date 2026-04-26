-- Create contact_documents table
CREATE TABLE public.contact_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_documents_contact_id ON public.contact_documents(contact_id);
CREATE INDEX idx_contact_documents_household_id ON public.contact_documents(household_id);

ALTER TABLE public.contact_documents ENABLE ROW LEVEL SECURITY;

-- Advisors can manage documents in their own households
CREATE POLICY "Advisors view their household documents"
ON public.contact_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = contact_documents.household_id
      AND (h.advisor_id = auth.uid() OR h.advisor_id = ANY (public.get_accessible_advisor_ids()))
  )
  OR public.is_gl_internal(auth.uid())
);

CREATE POLICY "Advisors insert their household documents"
ON public.contact_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = contact_documents.household_id
      AND (h.advisor_id = auth.uid() OR h.advisor_id = ANY (public.get_accessible_advisor_ids()))
  )
);

CREATE POLICY "Advisors delete their household documents"
ON public.contact_documents FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = contact_documents.household_id
      AND (h.advisor_id = auth.uid() OR h.advisor_id = ANY (public.get_accessible_advisor_ids()))
  )
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-documents', 'contact-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path is {household_id}/{contact_id}/{category}/{filename}
CREATE POLICY "Advisors read contact documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contact-documents'
  AND EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id::text = (storage.foldername(name))[1]
      AND (h.advisor_id = auth.uid() OR h.advisor_id = ANY (public.get_accessible_advisor_ids()))
  )
);

CREATE POLICY "Advisors upload contact documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contact-documents'
  AND EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id::text = (storage.foldername(name))[1]
      AND (h.advisor_id = auth.uid() OR h.advisor_id = ANY (public.get_accessible_advisor_ids()))
  )
);

CREATE POLICY "Advisors delete contact documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contact-documents'
  AND EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id::text = (storage.foldername(name))[1]
      AND (h.advisor_id = auth.uid() OR h.advisor_id = ANY (public.get_accessible_advisor_ids()))
  )
);