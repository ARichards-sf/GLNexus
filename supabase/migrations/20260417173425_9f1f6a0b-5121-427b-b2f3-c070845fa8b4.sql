ALTER TABLE public.contact_accounts
ADD COLUMN account_registration TEXT,
ADD COLUMN account_class TEXT,
ADD COLUMN objective TEXT,
ADD COLUMN br_suitability TEXT,
ADD COLUMN tier_schedule TEXT,
ADD COLUMN description TEXT,
ADD COLUMN lpl_linking_status TEXT,
ADD COLUMN lpl_type TEXT,
ADD COLUMN lpl_net_revenues NUMERIC,
ADD COLUMN lpl_last_updated TIMESTAMPTZ,
ADD COLUMN data_source TEXT DEFAULT 'manual';