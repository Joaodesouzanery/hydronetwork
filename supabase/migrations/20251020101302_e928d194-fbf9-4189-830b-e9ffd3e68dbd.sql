-- Add location fields to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Add comment
COMMENT ON COLUMN public.projects.address IS 'Full address of the project location';
COMMENT ON COLUMN public.projects.latitude IS 'Latitude coordinate';
COMMENT ON COLUMN public.projects.longitude IS 'Longitude coordinate';