-- Add separate material and labor price fields to materials table
ALTER TABLE public.materials 
ADD COLUMN material_price NUMERIC DEFAULT 0,
ADD COLUMN labor_price NUMERIC DEFAULT 0;

-- Update existing materials to use current_price as material_price
UPDATE public.materials 
SET material_price = current_price
WHERE material_price = 0;

-- Add comment to clarify the fields
COMMENT ON COLUMN public.materials.material_price IS 'Preço do material em reais';
COMMENT ON COLUMN public.materials.labor_price IS 'Preço da mão de obra em reais';
COMMENT ON COLUMN public.materials.current_price IS 'Preço total (material + mão de obra) - calculado automaticamente';