
-- 1. Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. RLS policies on user_roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. Add status and last_sign_in to profiles
ALTER TABLE public.profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN last_sign_in TIMESTAMPTZ;

-- 5. Update households SELECT policy: advisors see own, admins see all
DROP POLICY IF EXISTS "Advisors can view their own households" ON public.households;
CREATE POLICY "Advisors can view their own households"
ON public.households
FOR SELECT
TO authenticated
USING (auth.uid() = advisor_id OR public.has_role(auth.uid(), 'admin'));

-- 6. Update household_members SELECT policy
DROP POLICY IF EXISTS "Advisors can view their own household members" ON public.household_members;
CREATE POLICY "Advisors can view their own household members"
ON public.household_members
FOR SELECT
TO authenticated
USING (auth.uid() = advisor_id OR public.has_role(auth.uid(), 'admin'));

-- 7. Update compliance_notes SELECT policy
DROP POLICY IF EXISTS "Advisors can view their own compliance notes" ON public.compliance_notes;
CREATE POLICY "Advisors can view their own compliance notes"
ON public.compliance_notes
FOR SELECT
TO authenticated
USING (auth.uid() = advisor_id OR public.has_role(auth.uid(), 'admin'));

-- 8. Update contact_accounts SELECT policy
DROP POLICY IF EXISTS "Advisors can view their own contact accounts" ON public.contact_accounts;
CREATE POLICY "Advisors can view their own contact accounts"
ON public.contact_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = advisor_id OR public.has_role(auth.uid(), 'admin'));

-- 9. Update profiles policies: admins can view all, users view own
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 10. Admins can update any profile (for status toggling)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
