-- Add supplier, category and notes columns to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;