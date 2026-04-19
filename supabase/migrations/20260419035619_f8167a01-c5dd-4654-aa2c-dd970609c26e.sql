-- Allow GL internal users to read all households (for VPM service access)
CREATE POLICY "gl_internal_read_all_households"
ON public.households
FOR SELECT
TO authenticated
USING (
  auth.uid() = advisor_id
  OR public.is_gl_internal(auth.uid())
);

-- Allow GL internal to read all household_members
CREATE POLICY "gl_internal_read_all_members"
ON public.household_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = advisor_id
  OR public.is_gl_internal(auth.uid())
);

-- Allow GL internal to read all contact_accounts
CREATE POLICY "gl_internal_read_all_accounts"
ON public.contact_accounts
FOR SELECT
TO authenticated
USING (
  auth.uid() = advisor_id
  OR public.is_gl_internal(auth.uid())
);

-- Allow GL internal to read all compliance_notes
CREATE POLICY "gl_internal_read_all_notes"
ON public.compliance_notes
FOR SELECT
TO authenticated
USING (
  auth.uid() = advisor_id
  OR public.is_gl_internal(auth.uid())
);

-- Allow GL internal to read all calendar_events
CREATE POLICY "gl_internal_read_all_events"
ON public.calendar_events
FOR SELECT
TO authenticated
USING (
  auth.uid() = advisor_id
  OR public.is_gl_internal(auth.uid())
);

-- Allow GL internal to read all tasks
CREATE POLICY "gl_internal_read_all_tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  advisor_id = auth.uid()
  OR assigned_to = auth.uid()
  OR advisor_id = ANY(
    public.get_accessible_advisor_ids()
  )
  OR public.is_gl_internal(auth.uid())
);