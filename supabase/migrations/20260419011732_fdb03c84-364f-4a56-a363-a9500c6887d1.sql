-- Add VPM fields to profiles
ALTER TABLE public.profiles
ADD COLUMN vpm_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN vpm_billing_type TEXT DEFAULT 'none',
ADD COLUMN vpm_hourly_rate NUMERIC,
ADD COLUMN vpm_notes TEXT;

-- Add VPM fields to service_requests
ALTER TABLE public.service_requests
ADD COLUMN is_vpm BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN vpm_request_type TEXT,
ADD COLUMN vpm_timeline TEXT,
ADD COLUMN vpm_hours_logged NUMERIC DEFAULT 0,
ADD COLUMN vpm_hours_notes TEXT;

-- Index for VPM queue
CREATE INDEX idx_service_requests_vpm
ON public.service_requests(is_vpm, status)
WHERE is_vpm = true;