-- PARTE 2 DE 4: Features intermediárias
-- Cole este SQL no Supabase SQL Editor e clique Run


-- Migration: 20251023024736_7325ca95-89c4-450d-a375-32b1de62e27a.sql
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

-- Migration: 20251023025951_29ebf78a-a95e-43f9-b449-bc48723e7ae1.sql
-- Adicionar campo employee_id à tabela production_targets
ALTER TABLE public.production_targets 
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id);

-- Migration: 20251023030053_87170522-755e-4c68-95c6-172455cf37d4.sql
-- Adicionar campos climáticos à tabela daily_reports
ALTER TABLE public.daily_reports 
ADD COLUMN IF NOT EXISTS temperature NUMERIC,
ADD COLUMN IF NOT EXISTS humidity INTEGER,
ADD COLUMN IF NOT EXISTS wind_speed NUMERIC,
ADD COLUMN IF NOT EXISTS will_rain BOOLEAN,
ADD COLUMN IF NOT EXISTS weather_description TEXT,
ADD COLUMN IF NOT EXISTS terrain_condition TEXT,
ADD COLUMN IF NOT EXISTS gps_location TEXT,
ADD COLUMN IF NOT EXISTS general_observations TEXT;

-- Migration: 20251024184410_e584fdec-6135-42f9-860d-c0943d182dfb.sql
-- Create inventory (almoxarifado) table
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  material_name TEXT NOT NULL,
  material_code TEXT,
  category TEXT,
  unit TEXT,
  quantity_available NUMERIC NOT NULL DEFAULT 0,
  minimum_stock NUMERIC DEFAULT 0,
  location TEXT,
  supplier TEXT,
  unit_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view inventory from their projects"
  ON public.inventory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = inventory.project_id
      AND projects.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory items"
  ON public.inventory
  FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update inventory items they created"
  ON public.inventory
  FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete inventory items they created"
  ON public.inventory
  FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_inventory_project_id ON public.inventory(project_id);
CREATE INDEX idx_inventory_material_name ON public.inventory(material_name);
CREATE INDEX idx_inventory_category ON public.inventory(category);

-- Create inventory movements table for tracking stock changes
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'transferencia')),
  quantity NUMERIC NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for movements
CREATE POLICY "Users can view movements from their inventory"
  ON public.inventory_movements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventory i
      JOIN projects p ON p.id = i.project_id
      WHERE i.id = inventory_movements.inventory_id
      AND p.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory movements"
  ON public.inventory_movements
  FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

-- Create index for movements
CREATE INDEX idx_inventory_movements_inventory_id ON public.inventory_movements(inventory_id);
CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);

-- Migration: 20251024185204_3388a620-c96c-4ac5-98a1-52d988ce8c39.sql
-- Allow project_id to be nullable in inventory table
ALTER TABLE public.inventory 
ALTER COLUMN project_id DROP NOT NULL;

-- Migration: 20251024185556_ae7903e4-3d18-481f-b43e-8cc8838f3f22.sql
-- Create function to handle low stock alerts
CREATE OR REPLACE FUNCTION public.check_low_inventory_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if quantity is below or equal to minimum stock
  IF NEW.quantity_available <= NEW.minimum_stock THEN
    -- Check if there's an active alert configuration for low stock
    INSERT INTO alertas_historico (alerta_config_id, obra_id, mensagem)
    SELECT 
      ac.id,
      NEW.project_id,
      format('Estoque baixo: %s - Quantidade: %s %s (Mínimo: %s)', 
             NEW.material_name,
             NEW.quantity_available, 
             COALESCE(NEW.unit, ''),
             NEW.minimum_stock)
    FROM alertas_config ac
    WHERE ac.tipo_alerta = 'estoque_baixo'
      AND ac.ativo = true
      AND (ac.obra_id = NEW.project_id OR ac.obra_id IS NULL)
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for inventory low stock check
DROP TRIGGER IF EXISTS trigger_check_low_inventory_stock ON public.inventory;
CREATE TRIGGER trigger_check_low_inventory_stock
  AFTER UPDATE OF quantity_available ON public.inventory
  FOR EACH ROW
  WHEN (OLD.quantity_available <> NEW.quantity_available)
  EXECUTE FUNCTION public.check_low_inventory_stock();

-- Create function to link material requests to inventory when approved
CREATE OR REPLACE FUNCTION public.update_inventory_on_material_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  inventory_record RECORD;
BEGIN
  -- Only process when status changes to 'aprovado'
  IF NEW.status = 'aprovado' AND OLD.status <> 'aprovado' THEN
    -- Try to find matching inventory item
    SELECT * INTO inventory_record
    FROM inventory
    WHERE project_id = NEW.project_id
      AND LOWER(material_name) = LOWER(NEW.material_name)
    LIMIT 1;

    -- If found, create an entry movement
    IF FOUND THEN
      INSERT INTO inventory_movements (
        inventory_id,
        movement_type,
        quantity,
        reason,
        reference_type,
        reference_id,
        created_by_user_id
      ) VALUES (
        inventory_record.id,
        'entrada',
        NEW.quantity,
        format('Pedido aprovado - %s', NEW.requestor_name),
        'material_request',
        NEW.id,
        NEW.requested_by_user_id
      );

      -- Update inventory quantity
      UPDATE inventory
      SET quantity_available = quantity_available + NEW.quantity
      WHERE id = inventory_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for material request approval
DROP TRIGGER IF EXISTS trigger_update_inventory_on_approval ON public.material_requests;
CREATE TRIGGER trigger_update_inventory_on_approval
  AFTER UPDATE OF status ON public.material_requests
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION public.update_inventory_on_material_request_approval();

-- Add index for better performance on material name searches
CREATE INDEX IF NOT EXISTS idx_inventory_material_name_lower ON public.inventory(LOWER(material_name));
CREATE INDEX IF NOT EXISTS idx_material_requests_project_material ON public.material_requests(project_id, LOWER(material_name));

-- Migration: 20251024191154_776e6fb0-6515-4851-9e09-75af1df044f6.sql
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

-- Migration: 20251024191218_dc5b05bd-7a38-41b8-b576-63cd102b15e2.sql
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

-- Migration: 20251028004225_6c5c5ed4-e9ef-4e68-83a5-2ffb86281b4d.sql
-- Criar tabela de catálogo de ativos
CREATE TABLE public.assets_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- equipamento, área física, sistema
  detailed_location TEXT,
  tower TEXT,
  floor TEXT,
  sector TEXT,
  coordinates TEXT,
  main_responsible TEXT,
  technical_notes TEXT,
  created_by_user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.assets_catalog ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para assets_catalog
CREATE POLICY "Users can view assets from their projects"
ON public.assets_catalog FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = assets_catalog.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create assets"
ON public.assets_catalog FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update assets they created"
ON public.assets_catalog FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete assets they created"
ON public.assets_catalog FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Criar tabela de tarefas de manutenção
CREATE TABLE public.maintenance_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL, -- preventiva, corretiva, acompanhamento
  title TEXT NOT NULL,
  description TEXT,
  asset_id UUID REFERENCES public.assets_catalog(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_to_user_id UUID,
  assigned_to_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_processo, em_verificacao, concluida
  priority TEXT, -- baixa, média, alta, urgente
  classification TEXT, -- 1, 2
  service_type TEXT, -- civil, elétrica, hidráulica, etc
  service_subtype TEXT, -- pintura, reparo, etc
  deadline DATE,
  completion_notes TEXT,
  pending_reason TEXT,
  materials_used JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para maintenance_tasks
CREATE POLICY "Users can view tasks from their projects"
ON public.maintenance_tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_tasks.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tasks"
ON public.maintenance_tasks FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update tasks from their projects"
ON public.maintenance_tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = maintenance_tasks.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tasks they created"
ON public.maintenance_tasks FOR DELETE
USING (auth.uid() = created_by_user_id);

-- Criar tabela de checklist de tarefas preventivas
CREATE TABLE public.task_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by_user_id UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para task_checklist_items
CREATE POLICY "Users can view checklist items from their tasks"
ON public.task_checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create checklist items"
ON public.task_checklist_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update checklist items"
ON public.task_checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete checklist items"
ON public.task_checklist_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_checklist_items.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

-- Criar tabela de fotos de tarefas
CREATE TABLE public.task_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  uploaded_by_user_id UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para task_photos
CREATE POLICY "Users can view photos from their tasks"
ON public.task_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE mt.id = task_photos.task_id
    AND p.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload photos"
ON public.task_photos FOR INSERT
WITH CHECK (auth.uid() = uploaded_by_user_id);

CREATE POLICY "Users can delete their photos"
ON public.task_photos FOR DELETE
USING (auth.uid() = uploaded_by_user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_assets_catalog_updated_at
BEFORE UPDATE ON public.assets_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_tasks_updated_at
BEFORE UPDATE ON public.maintenance_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251028004639_d5ffefe1-931c-4726-b352-002fd72cd22c.sql
-- Criar bucket de storage para fotos de tarefas
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', false);

-- Políticas RLS para task-photos bucket
CREATE POLICY "Users can view task photos from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

CREATE POLICY "Users can upload task photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

CREATE POLICY "Users can delete their task photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-photos' AND
  EXISTS (
    SELECT 1 FROM maintenance_tasks mt
    JOIN projects p ON p.id = mt.project_id
    WHERE auth.uid() = p.created_by_user_id
    AND (storage.foldername(name))[1] = mt.id::text
  )
);

-- Migration: 20251029024322_59e60ac2-1e32-43a3-abf7-41058bc16953.sql
-- Create consumption readings table
CREATE TABLE public.consumption_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reading_time TEXT NOT NULL CHECK (reading_time IN ('08:00', '14:00', '18:00', '20:00')),
  meter_value NUMERIC NOT NULL,
  meter_type TEXT NOT NULL DEFAULT 'water',
  location TEXT,
  notes TEXT,
  recorded_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, reading_date, reading_time, meter_type, location)
);

-- Enable RLS
ALTER TABLE public.consumption_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view readings from their projects"
ON public.consumption_readings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = consumption_readings.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create readings"
ON public.consumption_readings FOR INSERT
WITH CHECK (auth.uid() = recorded_by_user_id);

CREATE POLICY "Users can update readings they created"
ON public.consumption_readings FOR UPDATE
USING (auth.uid() = recorded_by_user_id);

CREATE POLICY "Users can delete readings they created"
ON public.consumption_readings FOR DELETE
USING (auth.uid() = recorded_by_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_consumption_readings_updated_at
BEFORE UPDATE ON public.consumption_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251101131342_749c2de2-08c3-423d-b6dd-f42fed0386bd.sql
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

-- Migration: 20251101132518_ac1ed63e-4e20-43d4-94cc-4cad6c4e7499.sql
-- Add logo_url column to connection_reports table
ALTER TABLE connection_reports
ADD COLUMN logo_url text;

-- Update storage bucket policy to allow logo uploads in connection-report-photos
CREATE POLICY "Users can upload their own connection report files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: 20251102120053_8032ffa6-588b-4a18-9874-5c1925c888ab.sql
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

-- Migration: 20251105175051_9e58af56-9b93-4716-91ab-16537c7f67d0.sql
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role, _project_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (project_id = _project_id OR _project_id IS NULL)
  )
$$;

-- Create function to check if user is admin of any project
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles in their projects"
ON public.user_roles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can insert roles in their projects"
ON public.user_roles
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can update roles in their projects"
ON public.user_roles
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

CREATE POLICY "Admins can delete roles in their projects"
ON public.user_roles
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for backups metadata
CREATE TABLE public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL, -- 'manual' or 'automatic'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'in_progress'
  file_path TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for backups
CREATE POLICY "Users can view their own backups"
ON public.backups
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create backups"
ON public.backups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all backups in their projects"
ON public.backups
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin', project_id)
);

-- Migration: 20251113033446_3a59f28e-934e-4116-a2be-0a4bf975b39d.sql
-- Create materials table for budget module
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  color TEXT,
  measurement TEXT,
  unit TEXT NOT NULL,
  current_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(10,2) DEFAULT 0,
  current_stock NUMERIC(10,2) DEFAULT 0,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Create price history table
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  old_price NUMERIC(10,2) NOT NULL,
  new_price NUMERIC(10,2) NOT NULL,
  changed_by_user_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT
);

-- Create custom keywords table
CREATE TABLE IF NOT EXISTS public.custom_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  keyword_type TEXT NOT NULL, -- 'brand', 'color', 'unit', 'general'
  keyword_value TEXT NOT NULL,
  UNIQUE(created_by_user_id, keyword_type, keyword_value)
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  budget_number TEXT,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_contact TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'approved', 'rejected'
  valid_until DATE,
  payment_terms TEXT,
  notes TEXT,
  total_material NUMERIC(10,2) DEFAULT 0,
  total_labor NUMERIC(10,2) DEFAULT 0,
  total_bdi NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0
);

-- Create budget items table
CREATE TABLE IF NOT EXISTS public.budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price_material NUMERIC(10,2) DEFAULT 0,
  unit_price_labor NUMERIC(10,2) DEFAULT 0,
  bdi_percentage NUMERIC(5,2) DEFAULT 0,
  subtotal_material NUMERIC(10,2) DEFAULT 0,
  subtotal_labor NUMERIC(10,2) DEFAULT 0,
  subtotal_bdi NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  price_at_creation NUMERIC(10,2), -- Historical price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for materials
CREATE POLICY "Users can view their own materials"
  ON public.materials FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create materials"
  ON public.materials FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own materials"
  ON public.materials FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own materials"
  ON public.materials FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for price_history
CREATE POLICY "Users can view price history of their materials"
  ON public.price_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id = price_history.material_id
    AND m.created_by_user_id = auth.uid()
  ));

CREATE POLICY "System can insert price history"
  ON public.price_history FOR INSERT
  WITH CHECK (auth.uid() = changed_by_user_id);

-- RLS Policies for custom_keywords
CREATE POLICY "Users can view their own keywords"
  ON public.custom_keywords FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create keywords"
  ON public.custom_keywords FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own keywords"
  ON public.custom_keywords FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own keywords"
  ON public.custom_keywords FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for budgets
CREATE POLICY "Users can view their own budgets"
  ON public.budgets FOR SELECT
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can create budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own budgets"
  ON public.budgets FOR UPDATE
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their own budgets"
  ON public.budgets FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- RLS Policies for budget_items
CREATE POLICY "Users can view items from their budgets"
  ON public.budget_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create budget items"
  ON public.budget_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can update items from their budgets"
  ON public.budget_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items from their budgets"
  ON public.budget_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = budget_items.budget_id
    AND b.created_by_user_id = auth.uid()
  ));

-- Trigger to update materials updated_at
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update budgets updated_at
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to track price changes
CREATE OR REPLACE FUNCTION public.track_material_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_price IS DISTINCT FROM NEW.current_price THEN
    INSERT INTO public.price_history (
      material_id,
      old_price,
      new_price,
      changed_by_user_id
    ) VALUES (
      NEW.id,
      OLD.current_price,
      NEW.current_price,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to automatically track price changes
CREATE TRIGGER track_material_price_changes
  AFTER UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.track_material_price_change();

-- Function to recalculate budget totals
CREATE OR REPLACE FUNCTION public.recalculate_budget_totals()
RETURNS TRIGGER AS $$
DECLARE
  budget_totals RECORD;
BEGIN
  -- Calculate totals from budget items
  SELECT
    COALESCE(SUM(subtotal_material), 0) as total_mat,
    COALESCE(SUM(subtotal_labor), 0) as total_lab,
    COALESCE(SUM(subtotal_bdi), 0) as total_bdi_val,
    COALESCE(SUM(total), 0) as total_amt
  INTO budget_totals
  FROM public.budget_items
  WHERE budget_id = COALESCE(NEW.budget_id, OLD.budget_id);

  -- Update budget totals
  UPDATE public.budgets
  SET
    total_material = budget_totals.total_mat,
    total_labor = budget_totals.total_lab,
    total_bdi = budget_totals.total_bdi_val,
    total_amount = budget_totals.total_amt,
    updated_at = now()
  WHERE id = COALESCE(NEW.budget_id, OLD.budget_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to recalculate budget totals when items change
CREATE TRIGGER recalculate_budget_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_budget_totals();

-- Function to auto-generate budget number
CREATE OR REPLACE FUNCTION public.generate_budget_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.budget_number IS NULL OR NEW.budget_number = '' THEN
    NEW.budget_number := 'ORC-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('budget_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create sequence for budget numbers
CREATE SEQUENCE IF NOT EXISTS public.budget_number_seq START 1;

-- Trigger to auto-generate budget number
CREATE TRIGGER generate_budget_number_trigger
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_budget_number();

-- Migration: 20251119024111_8c0efa8c-aecb-48da-8855-36aa40648344.sql
-- Add synonyms column to custom_keywords table
ALTER TABLE custom_keywords 
ADD COLUMN synonyms text[] DEFAULT ARRAY[]::text[];

-- Migration: 20251120144049_391408c3-fdfd-4bbd-ba2f-24984c2d81c6.sql
-- Add supplier, category and notes columns to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migration: 20251121160314_c3b892ed-3c66-4a37-bb6e-542ada3c08b9.sql
-- Add materials_used column to connection_reports table
ALTER TABLE connection_reports
ADD COLUMN materials_used JSONB DEFAULT '[]'::jsonb;

-- Migration: 20251121180255_9a8accbd-06d3-400b-b020-ef3bfa8f16c2.sql
-- Adicionar campos de orçamento e equipe na tabela projects
ALTER TABLE public.projects 
ADD COLUMN total_budget NUMERIC,
ADD COLUMN team_members TEXT;

-- Criar tabela de checklists
CREATE TABLE public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de itens de checklist
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('done', 'pending', 'not_done')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies para checklists
CREATE POLICY "Users can view checklists from their projects"
ON public.checklists FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = checklists.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create checklists"
ON public.checklists FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their checklists"
ON public.checklists FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete their checklists"
ON public.checklists FOR DELETE
USING (auth.uid() = created_by_user_id);

-- RLS Policies para checklist_items
CREATE POLICY "Users can view checklist items from their projects"
ON public.checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create checklist items"
ON public.checklist_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update checklist items"
ON public.checklist_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete checklist items"
ON public.checklist_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.checklists
    JOIN public.projects ON projects.id = checklists.project_id
    WHERE checklists.id = checklist_items.checklist_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_checklists_updated_at
BEFORE UPDATE ON public.checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklist_items_updated_at
BEFORE UPDATE ON public.checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
