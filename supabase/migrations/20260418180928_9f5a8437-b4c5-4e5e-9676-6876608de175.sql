CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,

  -- Pipeline
  pipeline_stage TEXT NOT NULL DEFAULT 'lead',
  -- Values: 'lead', 'contacted', 'meeting_scheduled', 'discovery_complete',
  -- 'proposal_sent', 'converted', 'lost'

  -- Prospect intelligence
  estimated_aum NUMERIC,
  source TEXT,
  -- Values: 'referral', 'event', 'cold_outreach', 'social_media',
  -- 'existing_client', 'other'
  referred_by TEXT,
  notes TEXT,

  -- Conversion tracking
  converted_household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  lost_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- Advisors manage their own prospects
CREATE POLICY "advisors_select_prospects"
ON public.prospects FOR SELECT
TO authenticated
USING (
  advisor_id = auth.uid()
  OR advisor_id = ANY(public.get_accessible_advisor_ids())
);

CREATE POLICY "advisors_insert_prospects"
ON public.prospects FOR INSERT
TO authenticated
WITH CHECK (advisor_id = auth.uid());

CREATE POLICY "advisors_update_prospects"
ON public.prospects FOR UPDATE
TO authenticated
USING (
  advisor_id = auth.uid()
  OR advisor_id = ANY(public.get_accessible_advisor_ids())
);

CREATE POLICY "advisors_delete_prospects"
ON public.prospects FOR DELETE
TO authenticated
USING (advisor_id = auth.uid());

-- Indexes
CREATE INDEX idx_prospects_advisor ON public.prospects(advisor_id);
CREATE INDEX idx_prospects_stage ON public.prospects(pipeline_stage);
CREATE INDEX idx_prospects_converted ON public.prospects(converted_household_id) WHERE converted_household_id IS NOT NULL;