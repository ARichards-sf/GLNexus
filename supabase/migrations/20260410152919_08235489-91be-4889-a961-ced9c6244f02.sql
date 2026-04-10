
-- Allow unassigned contacts (nullable household_id)
ALTER TABLE public.household_members
  ALTER COLUMN household_id DROP NOT NULL;

-- Add last_contacted tracking
ALTER TABLE public.household_members
  ADD COLUMN last_contacted DATE;
