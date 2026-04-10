
CREATE TABLE public.daily_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advisor_id UUID NOT NULL,
  total_aum NUMERIC NOT NULL DEFAULT 0,
  household_count INTEGER NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (advisor_id, snapshot_date)
);

ALTER TABLE public.daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own snapshots"
  ON public.daily_snapshots FOR SELECT TO authenticated
  USING (auth.uid() = advisor_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advisors can insert their own snapshots"
  ON public.daily_snapshots FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own snapshots"
  ON public.daily_snapshots FOR UPDATE
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own snapshots"
  ON public.daily_snapshots FOR DELETE
  USING (auth.uid() = advisor_id);
