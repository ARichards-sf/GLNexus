-- PART 1: Lead advisor flag
ALTER TABLE public.firm_memberships
ADD COLUMN is_lead_advisor BOOLEAN NOT NULL DEFAULT false;

-- PART 1b: Create advisor_admin_relationships (referenced by accessor function)
CREATE TABLE public.advisor_admin_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_id, advisor_id)
);

ALTER TABLE public.advisor_admin_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advisor_admin_rel_select"
ON public.advisor_admin_relationships FOR SELECT
TO authenticated
USING (
  admin_id = auth.uid()
  OR advisor_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "advisor_admin_rel_insert"
ON public.advisor_admin_relationships FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "advisor_admin_rel_update"
ON public.advisor_admin_relationships FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "advisor_admin_rel_delete"
ON public.advisor_admin_relationships FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_advisor_admin_rel_admin ON public.advisor_admin_relationships(admin_id);
CREATE INDEX idx_advisor_admin_rel_advisor ON public.advisor_admin_relationships(advisor_id);

-- PART 2: Accessor function
CREATE OR REPLACE FUNCTION public.get_accessible_advisor_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT auth.uid()
    UNION
    SELECT advisor_id
    FROM public.advisor_admin_relationships
    WHERE admin_id = auth.uid()
    UNION
    SELECT fm2.user_id
    FROM public.firm_memberships fm1
    JOIN public.firm_memberships fm2
      ON fm2.firm_id = fm1.firm_id
    WHERE fm1.user_id = auth.uid()
      AND fm1.is_lead_advisor = true
      AND fm2.role = 'advisor'
    UNION
    SELECT fm.user_id
    FROM public.firm_memberships fm
    JOIN public.internal_user_firm_assignments iufa
      ON iufa.firm_id = fm.firm_id
    WHERE iufa.internal_user_id = auth.uid()
      AND fm.role = 'advisor'
    UNION
    SELECT DISTINCT advisor_id
    FROM public.households
    WHERE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND platform_role IN ('admin','super_admin')
    )
  )
$$;

-- PART 3: Tasks tables
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  task_type TEXT NOT NULL DEFAULT 'manual',
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.household_members(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE TABLE public.task_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PART 4: RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_select"
ON public.tasks FOR SELECT
TO authenticated
USING (
  advisor_id = auth.uid()
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR advisor_id = ANY(public.get_accessible_advisor_ids())
);

CREATE POLICY "task_insert"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  advisor_id = auth.uid()
  OR advisor_id = ANY(public.get_accessible_advisor_ids())
);

CREATE POLICY "task_update"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  advisor_id = auth.uid()
  OR assigned_to = auth.uid()
  OR advisor_id = ANY(public.get_accessible_advisor_ids())
);

CREATE POLICY "task_delete"
ON public.tasks FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR advisor_id = auth.uid()
);

CREATE POLICY "notification_select"
ON public.task_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notification_update"
ON public.task_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- PART 5: Indexes
CREATE INDEX idx_tasks_advisor_id ON public.tasks(advisor_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_household_id ON public.tasks(household_id);
CREATE INDEX idx_task_notif_user ON public.task_notifications(user_id);
CREATE INDEX idx_task_notif_unread ON public.task_notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_firm_lead ON public.firm_memberships(firm_id, is_lead_advisor) WHERE is_lead_advisor = true;