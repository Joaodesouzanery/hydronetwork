
-- Fix can_create_project to allow creation when no quota row exists
CREATE OR REPLACE FUNCTION public.can_create_project(user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  quota_exists BOOLEAN;
BEGIN
  -- Get current project count
  SELECT COUNT(*) INTO current_count
  FROM public.projects
  WHERE created_by_user_id = user_uuid;
  
  -- Check if quota row exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_quotas WHERE user_id = user_uuid
  ) INTO quota_exists;
  
  -- If no quota row, allow unlimited
  IF NOT quota_exists THEN
    RETURN true;
  END IF;
  
  -- Get max allowed
  SELECT COALESCE(max_projects, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$function$;

-- Also fix can_create_employee with the same pattern
CREATE OR REPLACE FUNCTION public.can_create_employee(user_uuid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  quota_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.employees
  WHERE created_by_user_id = user_uuid;
  
  SELECT EXISTS (
    SELECT 1 FROM public.user_quotas WHERE user_id = user_uuid
  ) INTO quota_exists;
  
  IF NOT quota_exists THEN
    RETURN true;
  END IF;
  
  SELECT COALESCE(max_employees, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$function$;
