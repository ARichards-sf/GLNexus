
-- =====================================================
-- 1) Fix firm_memberships SELECT exposure
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view firm memberships" ON public.firm_memberships;

CREATE POLICY "Users can view own firm memberships"
  ON public.firm_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_gl_internal(auth.uid())
  );

-- =====================================================
-- 2) Fix vpm_firm_assignments SELECT exposure
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view VPM firm assignments" ON public.vpm_firm_assignments;

CREATE POLICY "GL internal or own can view vpm assignments"
  ON public.vpm_firm_assignments FOR SELECT TO authenticated
  USING (
    vpm_user_id = auth.uid()
    OR public.is_gl_internal(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- =====================================================
-- 3) Fix profile privilege escalation
-- Prevent users from modifying privilege fields on their own profile
-- =====================================================
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND is_internal IS NOT DISTINCT FROM (SELECT p.is_internal FROM public.profiles p WHERE p.user_id = auth.uid())
    AND is_gl_internal IS NOT DISTINCT FROM (SELECT p.is_gl_internal FROM public.profiles p WHERE p.user_id = auth.uid())
    AND platform_role IS NOT DISTINCT FROM (SELECT p.platform_role FROM public.profiles p WHERE p.user_id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- =====================================================
-- 4) Restrict write policies to authenticated role only (not public)
-- =====================================================

-- compliance_notes
DROP POLICY IF EXISTS "Advisors can create their own compliance notes" ON public.compliance_notes;
DROP POLICY IF EXISTS "Advisors can update their own compliance notes" ON public.compliance_notes;
DROP POLICY IF EXISTS "Advisors can delete their own compliance notes" ON public.compliance_notes;
CREATE POLICY "Advisors can create their own compliance notes" ON public.compliance_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own compliance notes" ON public.compliance_notes FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own compliance notes" ON public.compliance_notes FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- households
DROP POLICY IF EXISTS "Advisors can create their own households" ON public.households;
DROP POLICY IF EXISTS "Advisors can update their own households" ON public.households;
DROP POLICY IF EXISTS "Advisors can delete their own households" ON public.households;
CREATE POLICY "Advisors can create their own households" ON public.households FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own households" ON public.households FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own households" ON public.households FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- household_members
DROP POLICY IF EXISTS "Advisors can create their own household members" ON public.household_members;
DROP POLICY IF EXISTS "Advisors can update their own household members" ON public.household_members;
DROP POLICY IF EXISTS "Advisors can delete their own household members" ON public.household_members;
CREATE POLICY "Advisors can create their own household members" ON public.household_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own household members" ON public.household_members FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own household members" ON public.household_members FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- contact_accounts
DROP POLICY IF EXISTS "Advisors can create their own contact accounts" ON public.contact_accounts;
DROP POLICY IF EXISTS "Advisors can update their own contact accounts" ON public.contact_accounts;
DROP POLICY IF EXISTS "Advisors can delete their own contact accounts" ON public.contact_accounts;
CREATE POLICY "Advisors can create their own contact accounts" ON public.contact_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own contact accounts" ON public.contact_accounts FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own contact accounts" ON public.contact_accounts FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- calendar_events
DROP POLICY IF EXISTS "Advisors can create their own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Advisors can update their own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Advisors can delete their own events" ON public.calendar_events;
CREATE POLICY "Advisors can create their own events" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own events" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own events" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- daily_snapshots
DROP POLICY IF EXISTS "Advisors can insert their own snapshots" ON public.daily_snapshots;
DROP POLICY IF EXISTS "Advisors can update their own snapshots" ON public.daily_snapshots;
DROP POLICY IF EXISTS "Advisors can delete their own snapshots" ON public.daily_snapshots;
CREATE POLICY "Advisors can insert their own snapshots" ON public.daily_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own snapshots" ON public.daily_snapshots FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own snapshots" ON public.daily_snapshots FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- household_snapshots
DROP POLICY IF EXISTS "Advisors can insert their own household snapshots" ON public.household_snapshots;
DROP POLICY IF EXISTS "Advisors can update their own household snapshots" ON public.household_snapshots;
DROP POLICY IF EXISTS "Advisors can delete their own household snapshots" ON public.household_snapshots;
CREATE POLICY "Advisors can insert their own household snapshots" ON public.household_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own household snapshots" ON public.household_snapshots FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own household snapshots" ON public.household_snapshots FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- account_snapshots
DROP POLICY IF EXISTS "Advisors can insert their own account snapshots" ON public.account_snapshots;
DROP POLICY IF EXISTS "Advisors can update their own account snapshots" ON public.account_snapshots;
DROP POLICY IF EXISTS "Advisors can delete their own account snapshots" ON public.account_snapshots;
CREATE POLICY "Advisors can insert their own account snapshots" ON public.account_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = advisor_id);
CREATE POLICY "Advisors can update their own account snapshots" ON public.account_snapshots FOR UPDATE TO authenticated USING (auth.uid() = advisor_id);
CREATE POLICY "Advisors can delete their own account snapshots" ON public.account_snapshots FOR DELETE TO authenticated USING (auth.uid() = advisor_id);

-- profiles INSERT
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 5) Storage: explicit UPDATE / DELETE policies for service-request-files
-- Owners (advisor) and admins can update/delete their own files (folder = user_id)
-- =====================================================
DROP POLICY IF EXISTS "Owners can update service request files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete service request files" ON storage.objects;

CREATE POLICY "Owners can update service request files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'service-request-files'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Owners can delete service request files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-request-files'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );
