
-- Household-level snapshots
CREATE TABLE public.household_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL,
  total_aum NUMERIC NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (household_id, snapshot_date)
);

ALTER TABLE public.household_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own household snapshots"
  ON public.household_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = advisor_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Advisors can insert their own household snapshots"
  ON public.household_snapshots FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own household snapshots"
  ON public.household_snapshots FOR UPDATE
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own household snapshots"
  ON public.household_snapshots FOR DELETE
  USING (auth.uid() = advisor_id);

-- Account-level snapshots
CREATE TABLE public.account_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.contact_accounts(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (account_id, snapshot_date)
);

ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own account snapshots"
  ON public.account_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = advisor_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Advisors can insert their own account snapshots"
  ON public.account_snapshots FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own account snapshots"
  ON public.account_snapshots FOR UPDATE
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own account snapshots"
  ON public.account_snapshots FOR DELETE
  USING (auth.uid() = advisor_id);
