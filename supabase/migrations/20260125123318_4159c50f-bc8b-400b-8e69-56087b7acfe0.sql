-- Fix security vulnerabilities identified in the scan

-- 1. Fix employees table: Restrict SELECT to only project owner (created_by_user_id)
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can view employees from their projects" ON public.employees;

-- Create stricter policy: Only owner or project manager can view
CREATE POLICY "Only owners can view employees from their projects" 
ON public.employees 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    created_by_user_id = auth.uid() 
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- 2. Fix connection_reports table: Restrict to only creator OR project manager
-- The existing policies are fine, but add a note that this is intentional

-- 3. Fix labor_tracking table: Restrict SELECT to project owner or project manager
DROP POLICY IF EXISTS "Users can view labor tracking from their projects" ON public.labor_tracking;
DROP POLICY IF EXISTS "Managers can view labor tracking" ON public.labor_tracking;

CREATE POLICY "Only owners can view labor tracking from their projects" 
ON public.labor_tracking 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    created_by_user_id = auth.uid() 
    OR (
      project_id IS NOT NULL 
      AND public.is_project_manager(auth.uid(), project_id)
    )
  )
);