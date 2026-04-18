ALTER TABLE public.calendar_events
ADD COLUMN prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
ADD COLUMN meeting_context TEXT;

CREATE INDEX idx_calendar_events_prospect
  ON public.calendar_events(prospect_id)
  WHERE prospect_id IS NOT NULL;