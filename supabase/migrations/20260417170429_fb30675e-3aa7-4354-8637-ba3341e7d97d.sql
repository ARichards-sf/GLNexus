-- 1. Add internal staff columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN platform_role text,
  ADD COLUMN department text,
  ADD COLUMN is_gl_internal boolean NOT NULL DEFAULT false;

-- 2. Add is_gl_internal flag to firms (marks the GL internal firm)
ALTER TABLE public.firms
  ADD COLUMN is_gl_internal boolean NOT NULL DEFAULT false;

-- 3. Create internal_user_firm_assignments table
CREATE TABLE public.internal_user_firm_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (internal_user_id, firm_id)
);

-- 4. Security definer helper to check GL internal status without recursion
CREATE OR REPLACE FUNCTION public.is_gl_internal(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND is_gl_internal = true
  )
$$;

-- 5. Enable RLS and add policies
ALTER TABLE public.internal_user_firm_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own internal firm assignments"
  ON public.internal_user_firm_assignments
  FOR SELECT
  TO authenticated
  USING (internal_user_id = auth.uid());

CREATE POLICY "GL internal staff can view all internal firm assignments"
  ON public.internal_user_firm_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_gl_internal(auth.uid()));

CREATE POLICY "GL internal staff can insert internal firm assignments"
  ON public.internal_user_firm_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_gl_internal(auth.uid()));

CREATE POLICY "GL internal staff can update internal firm assignments"
  ON public.internal_user_firm_assignments
  FOR UPDATE
  TO authenticated
  USING (public.is_gl_internal(auth.uid()));

CREATE POLICY "GL internal staff can delete internal firm assignments"
  ON public.internal_user_firm_assignments
  FOR DELETE
  TO authenticated
  USING (public.is_gl_internal(auth.uid()));

-- 6. Mark the Good Life Companies firm as the GL internal firm
UPDATE public.firms
  SET is_gl_internal = true
  WHERE name = 'Good Life Companies';
