
-- Add employment fields to household_members
ALTER TABLE public.household_members
  ADD COLUMN company TEXT,
  ADD COLUMN job_title TEXT;

-- Create contact_accounts table for individual assets
CREATE TABLE public.contact_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.household_members(id) ON DELETE CASCADE NOT NULL,
  advisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'Brokerage',
  account_number TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  institution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own contact accounts"
  ON public.contact_accounts FOR SELECT
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can create their own contact accounts"
  ON public.contact_accounts FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own contact accounts"
  ON public.contact_accounts FOR UPDATE
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own contact accounts"
  ON public.contact_accounts FOR DELETE
  USING (auth.uid() = advisor_id);

CREATE TRIGGER update_contact_accounts_updated_at
  BEFORE UPDATE ON public.contact_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
