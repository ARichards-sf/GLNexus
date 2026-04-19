-- Add household tiering and income tracking columns
ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS 
  annual_income NUMERIC,
ADD COLUMN IF NOT EXISTS 
  tier_score INTEGER,
ADD COLUMN IF NOT EXISTS 
  tier_last_assessed TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS 
  tier_pending_review TEXT,
  -- 'platinum' | 'gold' | 'silver'
ADD COLUMN IF NOT EXISTS 
  tier_pending_score INTEGER,
ADD COLUMN IF NOT EXISTS 
  tier_pending_reason TEXT;

-- Index for pending reviews (advisor dashboard query)
CREATE INDEX IF NOT EXISTS 
  idx_households_tier_pending
ON public.households(
  advisor_id, 
  tier_pending_review
) WHERE tier_pending_review 
  IS NOT NULL;

-- Index for annual reassessment
CREATE INDEX IF NOT EXISTS
  idx_households_tier_assessed
ON public.households(
  advisor_id,
  tier_last_assessed
);