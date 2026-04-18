-- Verify and fix cascade delete relationships for master-detail hierarchy
-- Household (parent) → household_members (child) → contact_accounts (grandchild)
-- Household → compliance_notes (child)
-- Household → calendar_events (child)
-- Household → tasks (child — set null not cascade)

-- 1. Fix contact_accounts: cascade delete from household_members
ALTER TABLE public.contact_accounts
DROP CONSTRAINT IF EXISTS contact_accounts_member_id_fkey;

ALTER TABLE public.contact_accounts
ADD CONSTRAINT contact_accounts_member_id_fkey
FOREIGN KEY (member_id) 
REFERENCES public.household_members(id)
ON DELETE CASCADE;

-- 2. Fix calendar_events: set null when household deleted (keep event record)
ALTER TABLE public.calendar_events
DROP CONSTRAINT IF EXISTS calendar_events_household_id_fkey;

ALTER TABLE public.calendar_events
ADD CONSTRAINT calendar_events_household_id_fkey
FOREIGN KEY (household_id)
REFERENCES public.households(id)
ON DELETE SET NULL;

-- 3. Fix tasks: set null when household deleted (preserve task history)
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_household_id_fkey;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_household_id_fkey
FOREIGN KEY (household_id)
REFERENCES public.households(id)
ON DELETE SET NULL;