
-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id uuid NOT NULL,
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  event_type text NOT NULL DEFAULT 'Discovery Call',
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add last_review_date to households
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS last_review_date date;

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Advisors can view their own events"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING ((auth.uid() = advisor_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Advisors can create their own events"
  ON public.calendar_events FOR INSERT
  TO public
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own events"
  ON public.calendar_events FOR UPDATE
  TO public
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own events"
  ON public.calendar_events FOR DELETE
  TO public
  USING (auth.uid() = advisor_id);

-- Updated_at trigger
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
