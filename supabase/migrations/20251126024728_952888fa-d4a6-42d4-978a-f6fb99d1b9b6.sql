-- Add keywords array and labor price to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update materials table to support material and labor pricing
COMMENT ON COLUMN public.materials.current_price IS 'Price for material cost';
COMMENT ON COLUMN public.materials.keywords IS 'Synonyms and keywords for AI identification';