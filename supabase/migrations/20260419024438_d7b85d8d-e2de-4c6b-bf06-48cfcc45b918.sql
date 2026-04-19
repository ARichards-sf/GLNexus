CREATE POLICY "gl_internal_update_requests"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() = advisor_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR public.is_gl_internal(auth.uid())
);

DROP POLICY IF EXISTS
  "Advisors can update their own requests"
ON public.service_requests;