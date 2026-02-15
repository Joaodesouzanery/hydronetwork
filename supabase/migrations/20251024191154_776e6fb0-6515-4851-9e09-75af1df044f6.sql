-- Add foreign key relationship between inventory and projects
ALTER TABLE public.inventory
ADD CONSTRAINT fk_inventory_project
FOREIGN KEY (project_id)
REFERENCES public.projects(id)
ON DELETE CASCADE;

-- Create sequence for automatic material codes
CREATE SEQUENCE IF NOT EXISTS public.inventory_code_seq START 1;

-- Create function to generate automatic material code
CREATE OR REPLACE FUNCTION public.generate_inventory_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate code if not provided
  IF NEW.material_code IS NULL OR NEW.material_code = '' THEN
    NEW.material_code := nextval('public.inventory_code_seq')::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate material codes
DROP TRIGGER IF EXISTS trigger_generate_inventory_code ON public.inventory;
CREATE TRIGGER trigger_generate_inventory_code
BEFORE INSERT ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.generate_inventory_code();

-- Storage policies for rdo-photos bucket
CREATE POLICY "Users can view photos from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rdo-photos' 
  AND auth.uid() IN (
    SELECT dr.executed_by_user_id
    FROM public.daily_reports dr
    JOIN public.rdo_validation_photos rvp ON rvp.daily_report_id = dr.id
    WHERE rvp.photo_url LIKE '%' || storage.objects.name || '%'
  )
);

CREATE POLICY "Users can upload photos to their RDOs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rdo-photos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rdo-photos'
  AND auth.uid() IN (
    SELECT dr.executed_by_user_id
    FROM public.daily_reports dr
    JOIN public.rdo_validation_photos rvp ON rvp.daily_report_id = dr.id
    WHERE rvp.photo_url LIKE '%' || storage.objects.name || '%'
  )
);