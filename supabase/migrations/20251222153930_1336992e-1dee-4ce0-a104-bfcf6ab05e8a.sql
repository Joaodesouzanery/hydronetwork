-- Make the interactive-maps bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'interactive-maps';

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view public maps" ON storage.objects;

-- Create new secure SELECT policy that verifies project ownership
CREATE POLICY "Users can view maps from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.created_by_user_id = auth.uid()
  )
);

-- Add database constraints for user_quotas
ALTER TABLE public.user_quotas
ADD CONSTRAINT check_max_projects 
  CHECK (max_projects >= 1 AND max_projects <= 100);

ALTER TABLE public.user_quotas
ADD CONSTRAINT check_max_employees 
  CHECK (max_employees >= 1 AND max_employees <= 10000);