
CREATE TABLE public.service_request_read_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE public.service_request_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own read status"
ON public.service_request_read_status
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own read status"
ON public.service_request_read_status
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read status"
ON public.service_request_read_status
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);
