
-- Trigger function to sync calendar_events → households
CREATE OR REPLACE FUNCTION public.sync_review_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_date date;
BEGIN
  -- Handle INSERT or UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.event_type = 'Annual Review' AND NEW.household_id IS NOT NULL THEN
      -- If completed, update last_review_date
      IF NEW.status = 'completed' THEN
        UPDATE households
        SET last_review_date = CURRENT_DATE,
            status = 'Active'
        WHERE id = NEW.household_id;
      END IF;

      -- Always recalculate next scheduled review date
      SELECT MIN(start_time::date) INTO v_next_date
      FROM calendar_events
      WHERE household_id = NEW.household_id
        AND event_type = 'Annual Review'
        AND status = 'scheduled'
        AND start_time > now();

      UPDATE households
      SET annual_review_date = v_next_date
      WHERE id = NEW.household_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.event_type = 'Annual Review' AND OLD.household_id IS NOT NULL THEN
      SELECT MIN(start_time::date) INTO v_next_date
      FROM calendar_events
      WHERE household_id = OLD.household_id
        AND event_type = 'Annual Review'
        AND status = 'scheduled'
        AND start_time > now();

      UPDATE households
      SET annual_review_date = v_next_date
      WHERE id = OLD.household_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_sync_review_dates
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_review_dates();
