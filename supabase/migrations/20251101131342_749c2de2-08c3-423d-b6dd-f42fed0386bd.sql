-- Create connection_reports table
CREATE TABLE public.connection_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  team_name TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  address TEXT NOT NULL,
  address_complement TEXT,
  client_name TEXT NOT NULL,
  water_meter_number TEXT NOT NULL,
  os_number TEXT NOT NULL,
  service_type TEXT NOT NULL,
  observations TEXT,
  photos_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.connection_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own connection reports"
ON public.connection_reports
FOR SELECT
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create connection reports"
ON public.connection_reports
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own connection reports"
ON public.connection_reports
FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own connection reports"
ON public.connection_reports
FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Create storage bucket for connection report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('connection-report-photos', 'connection-report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload connection report photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their connection report photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their connection report photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view public connection report photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'connection-report-photos');