
-- Service requests table
CREATE TABLE public.service_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advisor_id uuid NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  household_name text,
  household_aum numeric,
  household_id uuid,
  account_type text,
  account_institution text,
  account_id uuid,
  file_paths text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own requests"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = advisor_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advisors can create their own requests"
  ON public.service_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own requests"
  ON public.service_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = advisor_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for secure file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-request-files', 'service-request-files', false);

CREATE POLICY "Advisors can upload their own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'service-request-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Advisors can view their own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'service-request-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));
