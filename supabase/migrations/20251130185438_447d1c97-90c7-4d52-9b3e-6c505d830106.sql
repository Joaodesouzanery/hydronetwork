-- Create user quotas table to limit resources per user
CREATE TABLE IF NOT EXISTS public.user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_projects INTEGER DEFAULT 3,
  max_employees INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage quotas
CREATE POLICY "Super admins can manage all quotas"
ON public.user_quotas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  )
);

-- Users can view their own quotas
CREATE POLICY "Users can view own quotas"
ON public.user_quotas
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Function to check if user can create more projects
CREATE OR REPLACE FUNCTION public.can_create_project(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current project count
  SELECT COUNT(*) INTO current_count
  FROM public.projects
  WHERE created_by_user_id = user_uuid;
  
  -- Get max allowed (default to unlimited if no quota set)
  SELECT COALESCE(max_projects, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$$;

-- Function to check if user can create more employees
CREATE OR REPLACE FUNCTION public.can_create_employee(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current employee count
  SELECT COUNT(*) INTO current_count
  FROM public.employees
  WHERE created_by_user_id = user_uuid;
  
  -- Get max allowed (default to unlimited if no quota set)
  SELECT COALESCE(max_employees, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_user_quotas_updated_at
BEFORE UPDATE ON public.user_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();