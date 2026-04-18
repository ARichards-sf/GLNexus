-- Allow authenticated users to insert task notifications
CREATE POLICY "notification_insert"
ON public.task_notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Simplify task_insert policy
DROP POLICY IF EXISTS "task_insert" ON public.tasks;

CREATE POLICY "task_insert"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  advisor_id = auth.uid()
  OR created_by = auth.uid()
);