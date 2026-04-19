-- Add household FK for referrals (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prospects' 
    AND column_name = 'referred_by_household_id'
  ) THEN
    ALTER TABLE public.prospects
    ADD COLUMN referred_by_household_id UUID
      REFERENCES public.households(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index for referral queries (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_prospects_referrer'
  ) THEN
    CREATE INDEX idx_prospects_referrer
    ON public.prospects(
      referred_by_household_id
    ) WHERE referred_by_household_id IS NOT NULL;
  END IF;
END $$;

-- Index for conversion+referral queries (drop and recreate if exists with different columns)
DROP INDEX IF EXISTS idx_prospects_converted;

CREATE INDEX idx_prospects_converted
ON public.prospects(
  converted_household_id,
  referred_by_household_id
) WHERE converted_household_id 
  IS NOT NULL 
  AND referred_by_household_id 
  IS NOT NULL;