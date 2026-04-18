-- Add archive support to households (archived, not deleted)
ALTER TABLE public.households
ADD COLUMN archived_at TIMESTAMPTZ,
ADD COLUMN archived_reason TEXT;

-- Add soft-delete support to household_members
ALTER TABLE public.household_members
ADD COLUMN archived_at TIMESTAMPTZ;

-- Create view for active households (excludes archived)
CREATE OR REPLACE VIEW public.active_households AS
SELECT * FROM public.households
WHERE archived_at IS NULL;

-- Index for performance - quickly find active households
CREATE INDEX idx_households_archived
  ON public.households(archived_at)
  WHERE archived_at IS NULL;

-- Index for performance - quickly find active members
CREATE INDEX idx_members_archived
  ON public.household_members(archived_at)
  WHERE archived_at IS NULL;