-- Allow GL internal users to insert firm memberships
CREATE POLICY "gl_internal_insert_memberships"
ON public.firm_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_gl_internal(auth.uid())
);

-- Allow GL internal users to update firm memberships
CREATE POLICY "gl_internal_update_memberships"
ON public.firm_memberships
FOR UPDATE
TO authenticated
USING (
  public.is_gl_internal(auth.uid())
);

-- Allow GL internal users to delete firm memberships
CREATE POLICY "gl_internal_delete_memberships"
ON public.firm_memberships
FOR DELETE
TO authenticated
USING (
  public.is_gl_internal(auth.uid())
);