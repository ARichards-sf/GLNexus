-- Add pillar tracking fields to compliance_notes
ALTER TABLE public.compliance_notes
ADD COLUMN IF NOT EXISTS pillars_covered TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS meeting_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false;

-- Jump review items table
CREATE TABLE IF NOT EXISTS public.jump_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What type of item this is: 'contact' | 'account' | 'note' | 'planning_gap' | 'commitment'
  item_type TEXT NOT NULL,

  -- Which pillar: 'estate' | 'risk' | 'retirement' | 'assets' | null
  pillar TEXT,

  -- Extracted content payload
  content JSONB NOT NULL DEFAULT '{}',

  -- Review status: 'pending' | 'approved' | 'dismissed'
  status TEXT NOT NULL DEFAULT 'pending',

  -- Record created when approved
  approved_record_id UUID,
  approved_record_type TEXT,

  -- Source label (e.g. 'jump_ai', 'manual')
  source TEXT NOT NULL DEFAULT 'jump_ai',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jump_review_items_advisor
  ON public.jump_review_items(advisor_id);
CREATE INDEX IF NOT EXISTS idx_jump_review_items_status
  ON public.jump_review_items(advisor_id, status);
CREATE INDEX IF NOT EXISTS idx_jump_review_items_household
  ON public.jump_review_items(household_id) WHERE household_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jump_review_items_prospect
  ON public.jump_review_items(prospect_id) WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jump_review_items_task
  ON public.jump_review_items(task_id) WHERE task_id IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER update_jump_review_items_updated_at
BEFORE UPDATE ON public.jump_review_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.jump_review_items ENABLE ROW LEVEL SECURITY;

-- Advisors can view their own items; GL internal can view all
CREATE POLICY "Advisors view own jump review items"
ON public.jump_review_items
FOR SELECT
TO authenticated
USING (
  advisor_id = auth.uid()
  OR is_gl_internal(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Advisors can create their own items
CREATE POLICY "Advisors create own jump review items"
ON public.jump_review_items
FOR INSERT
TO authenticated
WITH CHECK (advisor_id = auth.uid());

-- Advisors can update their own items
CREATE POLICY "Advisors update own jump review items"
ON public.jump_review_items
FOR UPDATE
TO authenticated
USING (advisor_id = auth.uid());

-- Advisors can delete their own items
CREATE POLICY "Advisors delete own jump review items"
ON public.jump_review_items
FOR DELETE
TO authenticated
USING (advisor_id = auth.uid());