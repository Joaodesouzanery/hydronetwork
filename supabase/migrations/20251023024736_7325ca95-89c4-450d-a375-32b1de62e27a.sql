-- Criar tabela para fotos de validação dos RDOs
CREATE TABLE IF NOT EXISTS public.rdo_validation_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.rdo_validation_photos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fotos de validação
CREATE POLICY "Users can view photos from their projects"
ON public.rdo_validation_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_reports dr
    JOIN public.projects p ON p.id = dr.project_id
    WHERE dr.id = rdo_validation_photos.daily_report_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload photos to their RDOs"
ON public.rdo_validation_photos
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own photos"
ON public.rdo_validation_photos
FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Adicionar campo employee_id à tabela executed_services
ALTER TABLE public.executed_services 
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);

-- Criar bucket de storage para fotos de validação
INSERT INTO storage.buckets (id, name, public)
VALUES ('rdo-photos', 'rdo-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para fotos de validação
CREATE POLICY "Users can view their project photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'rdo-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);