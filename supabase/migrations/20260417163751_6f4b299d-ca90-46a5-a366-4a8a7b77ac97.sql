-- Add firm_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL;

-- Update all existing profiles to set firm_id to the Good Life Companies firm
UPDATE public.profiles
SET firm_id = (
  SELECT id FROM public.firms WHERE name = 'Good Life Companies' LIMIT 1
)
WHERE firm_id IS NULL;