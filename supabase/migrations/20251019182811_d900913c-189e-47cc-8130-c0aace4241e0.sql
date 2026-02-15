-- Add a temporary column to force types regeneration
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS temp_column text;

-- Remove the temporary column immediately
ALTER TABLE public.obras DROP COLUMN IF EXISTS temp_column;