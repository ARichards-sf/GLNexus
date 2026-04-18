-- Allow GL internal users to insert firms
CREATE POLICY "gl_internal_insert_firms"
ON public.firms
FOR INSERT
TO authenticated
WITH CHECK (public.is_gl_internal(auth.uid()));

-- Allow GL internal users to update firms
CREATE POLICY "gl_internal_update_firms"
ON public.firms
FOR UPDATE
TO authenticated
USING (public.is_gl_internal(auth.uid()));

-- Allow GL internal users to delete firms
-- (only non-GL-internal firms)
CREATE POLICY "gl_internal_delete_firms"
ON public.firms
FOR DELETE
TO authenticated
USING (
  public.is_gl_internal(auth.uid())
  AND is_gl_internal = false
);