
-- =============================================================
-- SECURITY FIX: Restrict connection_reports access to managers only
-- =============================================================

-- Drop the broad access policy
DROP POLICY IF EXISTS "Users with project access can view connection reports" ON public.connection_reports;

-- Create more restrictive policy - only creators and project managers
CREATE POLICY "Managers and creators can view connection reports"
ON public.connection_reports FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);
