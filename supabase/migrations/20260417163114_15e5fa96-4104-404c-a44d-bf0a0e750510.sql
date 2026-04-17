-- Create firms table
CREATE TABLE public.firms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    accent_color TEXT,
    allow_book_sharing BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create firm_memberships table
CREATE TABLE public.firm_memberships (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (firm_id, user_id)
);

-- Create vpm_firm_assignments table
CREATE TABLE public.vpm_firm_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vpm_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (vpm_user_id, firm_id)
);

-- Enable RLS on all three tables
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vpm_firm_assignments ENABLE ROW LEVEL SECURITY;

-- Add simple SELECT policies (to be tightened later)
CREATE POLICY "Authenticated users can view firms"
ON public.firms
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view firm memberships"
ON public.firm_memberships
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view VPM firm assignments"
ON public.vpm_firm_assignments
FOR SELECT
TO authenticated
USING (true);

-- Insert default firm
INSERT INTO public.firms (name, accent_color, allow_book_sharing)
VALUES ('Good Life Companies', '#1B3A6B', true);