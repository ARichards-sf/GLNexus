
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create households table
CREATE TABLE public.households (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  total_aum NUMERIC NOT NULL DEFAULT 0,
  risk_tolerance TEXT NOT NULL DEFAULT 'Moderate',
  investment_objective TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  next_action TEXT,
  next_action_date DATE,
  annual_review_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own households"
  ON public.households FOR SELECT
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can create their own households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own households"
  ON public.households FOR UPDATE
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own households"
  ON public.households FOR DELETE
  USING (auth.uid() = advisor_id);

-- Create household_members table
CREATE TABLE public.household_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  advisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own household members"
  ON public.household_members FOR SELECT
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can create their own household members"
  ON public.household_members FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own household members"
  ON public.household_members FOR UPDATE
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own household members"
  ON public.household_members FOR DELETE
  USING (auth.uid() = advisor_id);

-- Create compliance_notes table
CREATE TABLE public.compliance_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  advisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  advisor_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compliance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can view their own compliance notes"
  ON public.compliance_notes FOR SELECT
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can create their own compliance notes"
  ON public.compliance_notes FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update their own compliance notes"
  ON public.compliance_notes FOR UPDATE
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can delete their own compliance notes"
  ON public.compliance_notes FOR DELETE
  USING (auth.uid() = advisor_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
