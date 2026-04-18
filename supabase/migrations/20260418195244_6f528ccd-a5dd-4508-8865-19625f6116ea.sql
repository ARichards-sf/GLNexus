-- Verify household_members archived columns exist, add if missing
ALTER TABLE public.household_members
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_reason TEXT;

-- Add status lifecycle columns to contact_accounts
ALTER TABLE public.contact_accounts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_reason TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index for filtering active household members
CREATE INDEX IF NOT EXISTS idx_members_active
ON public.household_members(household_id, archived_at)
WHERE archived_at IS NULL;

-- Index for filtering active accounts by status
CREATE INDEX IF NOT EXISTS idx_accounts_active
ON public.contact_accounts(member_id, status)
WHERE status = 'active';