-- Allow GL internal users to read all service requests
-- (needed for All Requests queue AND VPM Requests queue)

CREATE POLICY "gl_internal_read_all_requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = advisor_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR public.is_gl_internal(auth.uid())
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS 
  "Advisors can view their own requests"
ON public.service_requests;