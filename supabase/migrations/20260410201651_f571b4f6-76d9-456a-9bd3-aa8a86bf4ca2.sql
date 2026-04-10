
CREATE TABLE public.service_request_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.service_request_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages if they own the request or are admin
CREATE POLICY "Users can view request messages"
ON public.service_request_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.id = request_id
    AND (sr.advisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Users can insert messages if they own the request or are admin
CREATE POLICY "Users can send request messages"
ON public.service_request_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.id = request_id
    AND (sr.advisor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_request_messages;
