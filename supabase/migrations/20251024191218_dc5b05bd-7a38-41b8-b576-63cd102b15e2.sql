-- Fix function search path for security
CREATE OR REPLACE FUNCTION public.generate_inventory_code()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate code if not provided
  IF NEW.material_code IS NULL OR NEW.material_code = '' THEN
    NEW.material_code := nextval('public.inventory_code_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;