-- Add interactive_map_url column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS interactive_map_url TEXT;

-- Create map_annotations table
CREATE TABLE public.map_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  porcentagem NUMERIC DEFAULT 0,
  team_id UUID REFERENCES public.employees(id),
  service_front_id UUID REFERENCES public.service_fronts(id),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.map_annotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for map_annotations
CREATE POLICY "Users can view map annotations from their projects"
ON public.map_annotations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = map_annotations.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create map annotations"
ON public.map_annotations
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update map annotations from their projects"
ON public.map_annotations
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = map_annotations.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete map annotations from their projects"
ON public.map_annotations
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = map_annotations.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_map_annotations_updated_at
BEFORE UPDATE ON public.map_annotations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for interactive maps
INSERT INTO storage.buckets (id, name, public)
VALUES ('interactive-maps', 'interactive-maps', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for interactive maps
CREATE POLICY "Users can upload maps to their project folders"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view public maps"
ON storage.objects
FOR SELECT
USING (bucket_id = 'interactive-maps');

CREATE POLICY "Users can update their own map files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own map files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
);