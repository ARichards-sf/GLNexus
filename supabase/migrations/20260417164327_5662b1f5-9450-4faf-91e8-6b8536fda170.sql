-- Allow admins to insert firm memberships
CREATE POLICY "Admins can insert firm memberships"
ON public.firm_memberships
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update firm memberships
CREATE POLICY "Admins can update firm memberships"
ON public.firm_memberships
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete firm memberships
CREATE POLICY "Admins can delete firm memberships"
ON public.firm_memberships
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));