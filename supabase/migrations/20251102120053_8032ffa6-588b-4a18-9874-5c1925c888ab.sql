-- Fix material_requests foreign key to employees
ALTER TABLE public.material_requests
ADD CONSTRAINT material_requests_requested_by_employee_id_fkey 
FOREIGN KEY (requested_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Create maintenance_qr_codes table
CREATE TABLE public.maintenance_qr_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  location_name TEXT NOT NULL,
  location_description TEXT,
  qr_code_data TEXT NOT NULL UNIQUE,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Create maintenance_requests table  
CREATE TABLE public.maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  requester_contact TEXT,
  issue_description TEXT NOT NULL,
  urgency_level TEXT NOT NULL DEFAULT 'normal',
  photos_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID,
  resolution_notes TEXT
);

-- Enable RLS
ALTER TABLE public.maintenance_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for maintenance_qr_codes
CREATE POLICY "Users can view QR codes from their projects"
ON public.maintenance_qr_codes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_qr_codes.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create QR codes for their projects"
ON public.maintenance_qr_codes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_qr_codes.project_id
    AND projects.created_by_user_id = auth.uid()
  ) AND auth.uid() = created_by_user_id
);

CREATE POLICY "Users can update their QR codes"
ON public.maintenance_qr_codes FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their QR codes"
ON public.maintenance_qr_codes FOR DELETE
USING (auth.uid() = created_by_user_id);

-- RLS Policies for maintenance_requests (public can create, owners can view)
CREATE POLICY "Anyone can create maintenance requests"
ON public.maintenance_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view requests from their QR codes"
ON public.maintenance_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM maintenance_qr_codes qr
    JOIN projects p ON p.id = qr.project_id
    WHERE qr.id = maintenance_requests.qr_code_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update requests from their projects"
ON public.maintenance_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM maintenance_qr_codes qr
    JOIN projects p ON p.id = qr.project_id
    WHERE qr.id = maintenance_requests.qr_code_id
    AND p.created_by_user_id = auth.uid()
  )
);

-- Foreign keys
ALTER TABLE public.maintenance_qr_codes
ADD CONSTRAINT maintenance_qr_codes_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_requests
ADD CONSTRAINT maintenance_requests_qr_code_id_fkey 
FOREIGN KEY (qr_code_id) REFERENCES public.maintenance_qr_codes(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_maintenance_qr_codes_project_id ON maintenance_qr_codes(project_id);
CREATE INDEX idx_maintenance_qr_codes_qr_code_data ON maintenance_qr_codes(qr_code_data);
CREATE INDEX idx_maintenance_requests_qr_code_id ON maintenance_requests(qr_code_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);

-- Updated_at trigger for maintenance_qr_codes
CREATE TRIGGER update_maintenance_qr_codes_updated_at
BEFORE UPDATE ON public.maintenance_qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for maintenance_requests
CREATE TRIGGER update_maintenance_requests_updated_at
BEFORE UPDATE ON public.maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for maintenance request photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('maintenance-request-photos', 'maintenance-request-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for maintenance request photos
CREATE POLICY "Anyone can upload maintenance request photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Users can delete maintenance request photos from their projects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-request-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_requests mr
    JOIN maintenance_qr_codes qr ON qr.id = mr.qr_code_id
    JOIN projects p ON p.id = qr.project_id
    WHERE p.created_by_user_id = auth.uid()
  )
);