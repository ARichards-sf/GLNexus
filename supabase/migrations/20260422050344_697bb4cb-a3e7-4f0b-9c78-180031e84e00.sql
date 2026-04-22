CREATE SEQUENCE IF NOT EXISTS public.vpm_ticket_number_seq START WITH 1000;

ALTER TABLE public.service_requests
ADD COLUMN IF NOT EXISTS ticket_number integer;

ALTER SEQUENCE public.vpm_ticket_number_seq
OWNED BY public.service_requests.ticket_number;

WITH ordered_requests AS (
  SELECT id
  FROM public.service_requests
  WHERE is_vpm = true
    AND ticket_number IS NULL
  ORDER BY created_at ASC, id ASC
)
UPDATE public.service_requests sr
SET ticket_number = nextval('public.vpm_ticket_number_seq')
FROM ordered_requests
WHERE sr.id = ordered_requests.id;

SELECT setval(
  'public.vpm_ticket_number_seq',
  GREATEST(
    COALESCE((SELECT MAX(ticket_number) FROM public.service_requests WHERE is_vpm = true), 999),
    999
  ),
  true
);

CREATE UNIQUE INDEX IF NOT EXISTS service_requests_vpm_ticket_number_unique_idx
ON public.service_requests (ticket_number)
WHERE is_vpm = true AND ticket_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_vpm_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_vpm = true AND NEW.ticket_number IS NULL THEN
    NEW.ticket_number := nextval('public.vpm_ticket_number_seq');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vpm_ticket_number_trigger ON public.service_requests;

CREATE TRIGGER vpm_ticket_number_trigger
BEFORE INSERT ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.assign_vpm_ticket_number();