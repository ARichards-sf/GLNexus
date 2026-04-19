ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_prime_partner BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS prime_partner_since DATE,
ADD COLUMN IF NOT EXISTS prime_revenue_share NUMERIC,
ADD COLUMN IF NOT EXISTS prime_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_prime
ON public.profiles(is_prime_partner)
WHERE is_prime_partner = true;