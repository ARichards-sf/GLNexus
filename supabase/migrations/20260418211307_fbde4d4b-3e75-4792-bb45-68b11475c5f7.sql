-- Allow GL internal users to read all profiles for admin purposes
CREATE POLICY "gl_internal_read_all_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_gl_internal(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;