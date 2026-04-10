
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Automation logs table
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  message text,
  records_processed integer DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view automation logs"
  ON public.automation_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add unique constraints for upsert logic
ALTER TABLE public.daily_snapshots
  ADD CONSTRAINT daily_snapshots_advisor_date_uq UNIQUE (advisor_id, snapshot_date);

ALTER TABLE public.household_snapshots
  ADD CONSTRAINT household_snapshots_household_date_uq UNIQUE (household_id, snapshot_date);

ALTER TABLE public.account_snapshots
  ADD CONSTRAINT account_snapshots_account_date_uq UNIQUE (account_id, snapshot_date);

-- The snapshot generation function
CREATE OR REPLACE FUNCTION public.generate_daily_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_count integer := 0;
  v_advisor record;
  v_today date := CURRENT_DATE;
BEGIN
  -- Create log entry
  INSERT INTO automation_logs (function_name, status, started_at)
  VALUES ('generate_daily_snapshots', 'running', now())
  RETURNING id INTO v_log_id;

  BEGIN
    -- Loop through active advisors
    FOR v_advisor IN
      SELECT user_id FROM profiles WHERE status = 'active'
    LOOP
      -- Daily snapshot: total AUM and household count
      INSERT INTO daily_snapshots (advisor_id, snapshot_date, total_aum, household_count)
      SELECT
        v_advisor.user_id,
        v_today,
        COALESCE(SUM(total_aum), 0),
        COUNT(*)
      FROM households
      WHERE advisor_id = v_advisor.user_id AND status = 'Active'
      ON CONFLICT (advisor_id, snapshot_date)
      DO UPDATE SET
        total_aum = EXCLUDED.total_aum,
        household_count = EXCLUDED.household_count;

      -- Household snapshots
      INSERT INTO household_snapshots (advisor_id, household_id, snapshot_date, total_aum)
      SELECT
        v_advisor.user_id,
        h.id,
        v_today,
        h.total_aum
      FROM households h
      WHERE h.advisor_id = v_advisor.user_id AND h.status = 'Active'
      ON CONFLICT (household_id, snapshot_date)
      DO UPDATE SET total_aum = EXCLUDED.total_aum;

      -- Account snapshots
      INSERT INTO account_snapshots (advisor_id, account_id, snapshot_date, balance)
      SELECT
        v_advisor.user_id,
        ca.id,
        v_today,
        ca.balance
      FROM contact_accounts ca
      WHERE ca.advisor_id = v_advisor.user_id
      ON CONFLICT (account_id, snapshot_date)
      DO UPDATE SET balance = EXCLUDED.balance;

      v_count := v_count + 1;
    END LOOP;

    -- Mark success
    UPDATE automation_logs
    SET status = 'success',
        message = 'Processed ' || v_count || ' advisors',
        records_processed = v_count,
        completed_at = now()
    WHERE id = v_log_id;

  EXCEPTION WHEN OTHERS THEN
    UPDATE automation_logs
    SET status = 'error',
        message = SQLERRM,
        completed_at = now()
    WHERE id = v_log_id;
    RAISE;
  END;
END;
$$;
