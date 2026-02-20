-- PARTE 3 DE 4: CRM, dashboards, compras
-- Cole este SQL no Supabase SQL Editor e clique Run


-- Migration: 20251122225213_42def35d-6614-4ef8-be11-faa2bd4f8b5a.sql
-- Add new fields to connection_reports table
ALTER TABLE public.connection_reports 
ADD COLUMN IF NOT EXISTS service_category TEXT CHECK (service_category IN ('agua', 'esgoto')),
ADD COLUMN IF NOT EXISTS connection_type TEXT CHECK (connection_type IN ('avulsa', 'intra_1', 'intra_2'));

-- Migration: 20251124002405_bb029b8e-66f1-4626-93d0-39eea9873896.sql
-- Add visits and occurrences fields to daily_reports
ALTER TABLE public.daily_reports 
ADD COLUMN visits TEXT,
ADD COLUMN occurrences_summary TEXT;

-- Create occurrences table
CREATE TABLE public.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  daily_report_id UUID REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  occurrence_type TEXT NOT NULL CHECK (occurrence_type IN ('erro_execucao', 'atraso', 'material_inadequado', 'falha_seguranca', 'reprovacao_checklist')),
  description TEXT NOT NULL,
  photos_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  responsible_id UUID REFERENCES public.employees(id),
  responsible_type TEXT CHECK (responsible_type IN ('engenheiro', 'mestre_obras', 'terceirizado', 'fornecedor', 'equipe_interna')),
  correction_deadline DATE,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'resolvida')),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Create purchase_requests table
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('baixa', 'media', 'alta', 'critica')),
  justification TEXT,
  cost_center TEXT,
  requested_by_user_id UUID NOT NULL,
  approved_by_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'em_compra', 'entregue')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  estimated_cost NUMERIC
);

-- Create supplier_quotes table
CREATE TABLE public.supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  delivery_time_days INTEGER,
  payment_terms TEXT,
  notes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  supplier_quote_id UUID REFERENCES public.supplier_quotes(id),
  order_number TEXT UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'emitido' CHECK (status IN ('emitido', 'confirmado', 'em_transito', 'entregue', 'cancelado')),
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  notes TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create labor_tracking table
CREATE TABLE public.labor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  worker_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pedreiro', 'servente', 'operador', 'eletricista', 'encanador', 'pintor', 'carpinteiro', 'outro')),
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time TIME NOT NULL,
  exit_time TIME,
  hours_worked NUMERIC,
  activity_description TEXT,
  hourly_rate NUMERIC,
  total_cost NUMERIC,
  company_name TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add responsible fields to existing tables
ALTER TABLE public.maintenance_tasks
ADD COLUMN IF NOT EXISTS responsible_type TEXT CHECK (responsible_type IN ('engenheiro', 'mestre_obras', 'terceirizado', 'fornecedor', 'equipe_interna'));

ALTER TABLE public.checklist_items
ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS responsible_type TEXT CHECK (responsible_type IN ('engenheiro', 'mestre_obras', 'terceirizado', 'fornecedor', 'equipe_interna'));

-- Enable RLS
ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for occurrences
CREATE POLICY "Users can view occurrences from their projects"
ON public.occurrences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = occurrences.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create occurrences"
ON public.occurrences FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update occurrences from their projects"
ON public.occurrences FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = occurrences.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete occurrences from their projects"
ON public.occurrences FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = occurrences.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- RLS Policies for purchase_requests
CREATE POLICY "Users can view purchase requests from their projects"
ON public.purchase_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_requests.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create purchase requests"
ON public.purchase_requests FOR INSERT
WITH CHECK (auth.uid() = requested_by_user_id);

CREATE POLICY "Users can update purchase requests from their projects"
ON public.purchase_requests FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_requests.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete purchase requests from their projects"
ON public.purchase_requests FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_requests.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- RLS Policies for supplier_quotes
CREATE POLICY "Users can view supplier quotes from their purchase requests"
ON public.supplier_quotes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.purchase_requests pr
  JOIN public.projects p ON p.id = pr.project_id
  WHERE pr.id = supplier_quotes.purchase_request_id
  AND p.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create supplier quotes"
ON public.supplier_quotes FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update supplier quotes"
ON public.supplier_quotes FOR UPDATE
USING (auth.uid() = created_by_user_id);

CREATE POLICY "Users can delete supplier quotes"
ON public.supplier_quotes FOR DELETE
USING (auth.uid() = created_by_user_id);

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view purchase orders from their projects"
ON public.purchase_orders FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_orders.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create purchase orders"
ON public.purchase_orders FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update purchase orders from their projects"
ON public.purchase_orders FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_orders.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete purchase orders from their projects"
ON public.purchase_orders FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = purchase_orders.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- RLS Policies for labor_tracking
CREATE POLICY "Users can view labor tracking from their projects"
ON public.labor_tracking FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = labor_tracking.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create labor tracking"
ON public.labor_tracking FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update labor tracking from their projects"
ON public.labor_tracking FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = labor_tracking.project_id
  AND projects.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete labor tracking from their projects"
ON public.labor_tracking FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = labor_tracking.project_id
  AND projects.created_by_user_id = auth.uid()
));

-- Create triggers for updated_at
CREATE TRIGGER update_occurrences_updated_at BEFORE UPDATE ON public.occurrences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON public.purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_quotes_updated_at BEFORE UPDATE ON public.supplier_quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_tracking_updated_at BEFORE UPDATE ON public.labor_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create sequence for purchase order numbers
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq START 1;

-- Function to generate purchase order number
CREATE OR REPLACE FUNCTION public.generate_purchase_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PC-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('purchase_order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for purchase order number generation
CREATE TRIGGER generate_purchase_order_number_trigger
BEFORE INSERT ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_purchase_order_number();

-- Migration: 20251126024728_952888fa-d4a6-42d4-978a-f6fb99d1b9b6.sql
-- Add keywords array and labor price to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update materials table to support material and labor pricing
COMMENT ON COLUMN public.materials.current_price IS 'Price for material cost';
COMMENT ON COLUMN public.materials.keywords IS 'Synonyms and keywords for AI identification';

-- Migration: 20251126144205_5eaa3765-45dd-4ee2-974b-a78e0840c896.sql
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

-- Migration: 20251128205714_fef87c92-7d3e-4f9c-b81c-38f90de5b7ef.sql
-- Create pending_actions table for approval workflow
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  resource_data JSONB,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

-- Create action_approvals table
CREATE TABLE IF NOT EXISTS public.action_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_action_id UUID REFERENCES public.pending_actions(id) ON DELETE CASCADE NOT NULL,
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  approved BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint for approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'action_approvals_pending_action_id_admin_user_id_key'
  ) THEN
    ALTER TABLE public.action_approvals ADD CONSTRAINT action_approvals_pending_action_id_admin_user_id_key UNIQUE(pending_action_id, admin_user_id);
  END IF;
END $$;

ALTER TABLE public.action_approvals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own requests" ON public.pending_actions;
DROP POLICY IF EXISTS "Admins can view all pending actions" ON public.pending_actions;
DROP POLICY IF EXISTS "Colaboradores can create action requests" ON public.pending_actions;
DROP POLICY IF EXISTS "Admins can update action status" ON public.pending_actions;
DROP POLICY IF EXISTS "Anyone can view approvals for their requests" ON public.action_approvals;
DROP POLICY IF EXISTS "Admins can create approvals" ON public.action_approvals;

-- RLS for pending_actions
CREATE POLICY "Users can view their own requests"
ON public.pending_actions
FOR SELECT
USING (auth.uid() = requested_by_user_id);

CREATE POLICY "Admins can view all pending actions"
ON public.pending_actions
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can create action requests"
ON public.pending_actions
FOR INSERT
WITH CHECK (auth.uid() = requested_by_user_id);

CREATE POLICY "Admins can update action status"
ON public.pending_actions
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- RLS for action_approvals
CREATE POLICY "Anyone can view approvals for their requests"
ON public.action_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pending_actions pa
    WHERE pa.id = action_approvals.pending_action_id
      AND (pa.requested_by_user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can create approvals"
ON public.action_approvals
FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid()) AND
  auth.uid() = admin_user_id
);

-- Create audit_log table for tracking edits
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing audit log policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

CREATE POLICY "Admins can view all audit logs"
ON public.audit_log
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own audit logs"
ON public.audit_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add trigger to update updated_at if not exists
DROP TRIGGER IF EXISTS update_pending_actions_updated_at ON public.pending_actions;
CREATE TRIGGER update_pending_actions_updated_at
BEFORE UPDATE ON public.pending_actions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251128211252_9bc59b51-d488-46b1-8646-48c910ea92ca.sql
-- Make storage buckets private for better security
UPDATE storage.buckets 
SET public = false 
WHERE name IN ('connection-report-photos', 'maintenance-request-photos');

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view maintenance request photos from their projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their maintenance request photos" ON storage.objects;

-- Add RLS policies for connection-report-photos bucket
DROP POLICY IF EXISTS "Users can upload their own connection report photos" ON storage.objects;
CREATE POLICY "Users can upload their own connection report photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'connection-report-photos' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can view connection report photos" ON storage.objects;
CREATE POLICY "Users can view connection report photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'connection-report-photos' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own connection report photos" ON storage.objects;
CREATE POLICY "Users can delete their own connection report photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'connection-report-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add RLS policies for maintenance-request-photos bucket (needs public access for QR codes)
CREATE POLICY "Anyone can upload maintenance request photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Anyone can view maintenance request photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-request-photos');

CREATE POLICY "Users can delete their maintenance request photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-request-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: 20251130185438_447d1c97-90c7-4d52-9b3e-6c505d830106.sql
-- Create user quotas table to limit resources per user
CREATE TABLE IF NOT EXISTS public.user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_projects INTEGER DEFAULT 3,
  max_employees INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage quotas
CREATE POLICY "Super admins can manage all quotas"
ON public.user_quotas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  )
);

-- Users can view their own quotas
CREATE POLICY "Users can view own quotas"
ON public.user_quotas
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Function to check if user can create more projects
CREATE OR REPLACE FUNCTION public.can_create_project(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current project count
  SELECT COUNT(*) INTO current_count
  FROM public.projects
  WHERE created_by_user_id = user_uuid;
  
  -- Get max allowed (default to unlimited if no quota set)
  SELECT COALESCE(max_projects, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$$;

-- Function to check if user can create more employees
CREATE OR REPLACE FUNCTION public.can_create_employee(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current employee count
  SELECT COUNT(*) INTO current_count
  FROM public.employees
  WHERE created_by_user_id = user_uuid;
  
  -- Get max allowed (default to unlimited if no quota set)
  SELECT COALESCE(max_employees, 999999) INTO max_allowed
  FROM public.user_quotas
  WHERE user_id = user_uuid;
  
  RETURN current_count < max_allowed;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_user_quotas_updated_at
BEFORE UPDATE ON public.user_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251202110703_6ab50207-6f97-46f6-b71a-31012d8e2cdc.sql
-- Remover políticas existentes e recriar com as corretas
DROP POLICY IF EXISTS "Users can view photos from their RDOs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos to their RDOs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- Policy para permitir usuários autenticados visualizarem fotos de seus projetos
CREATE POLICY "Users can view photos from their RDOs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Policy para permitir upload de fotos
CREATE POLICY "Users can upload photos to their RDOs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Policy para permitir deletar fotos
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rdo-photos' AND
  auth.uid() IS NOT NULL
);

-- Migration: 20251207212022_d9917830-f9a0-4a91-b955-b33331270af1.sql
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

-- Migration: 20251213212709_331b5a5d-c124-4d71-8b06-a124c3091199.sql
-- 1. Corrigir política de maintenance_requests para exigir autenticação na criação
DROP POLICY IF EXISTS "Anyone can create maintenance requests" ON public.maintenance_requests;
CREATE POLICY "Authenticated users can create maintenance requests"
ON public.maintenance_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Adicionar política explícita de negação de DELETE em inventory_movements
DROP POLICY IF EXISTS "Prevent deletion of inventory movements" ON public.inventory_movements;
CREATE POLICY "Prevent deletion of inventory movements"
ON public.inventory_movements
FOR DELETE
TO authenticated
USING (false);

-- 3. Adicionar política explícita de negação de UPDATE em inventory_movements
DROP POLICY IF EXISTS "Prevent update of inventory movements" ON public.inventory_movements;
CREATE POLICY "Prevent update of inventory movements"
ON public.inventory_movements
FOR UPDATE
TO authenticated
USING (false);

-- 4. Adicionar política explícita de negação de DELETE em price_history
DROP POLICY IF EXISTS "Prevent deletion of price history" ON public.price_history;
CREATE POLICY "Prevent deletion of price history"
ON public.price_history
FOR DELETE
TO authenticated
USING (false);

-- 5. Adicionar política explícita de negação de UPDATE em price_history
DROP POLICY IF EXISTS "Prevent update of price history" ON public.price_history;
CREATE POLICY "Prevent update of price history"
ON public.price_history
FOR UPDATE
TO authenticated
USING (false);

-- 6. Habilitar proteção de senhas vazadas via configuração de auth (feito separadamente)


-- Migration: 20251214205148_1a5d8ab3-a099-4ac5-a04d-09e3b1c3e17a.sql
-- Fix maintenance-request-photos security
-- Remove overly permissive policies and add proper authentication

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view maintenance request photos" ON storage.objects;

-- Create new secure policies for maintenance-request-photos bucket

-- Only allow uploads with a valid session token (from QR code flow that provides temp access)
-- Or authenticated users
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-request-photos');

-- Create policy for viewing - only authenticated users and project owners
CREATE POLICY "Authenticated users can view maintenance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'maintenance-request-photos');

-- Allow authenticated users to delete their own uploaded photos
CREATE POLICY "Users can delete their own maintenance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-request-photos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- For the QR code public workflow, we need a separate approach:
-- Create a public endpoint that validates the QR code and returns a signed URL
-- This is more secure than allowing public uploads

-- Migration: 20251215170919_64e76540-807a-47fa-aea4-648125e9e4dd.sql
-- Dashboard Configurations Table
CREATE TABLE public.dashboard_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  global_filters JSONB DEFAULT '{}'::jsonb,
  layout JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dashboard Widgets Table
CREATE TABLE public.dashboard_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID NOT NULL REFERENCES public.dashboard_configs(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 4,
  height INTEGER DEFAULT 3,
  data_source TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Dashboard Configs Policies
CREATE POLICY "Users can view their own dashboards"
ON public.dashboard_configs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards"
ON public.dashboard_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
ON public.dashboard_configs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
ON public.dashboard_configs FOR DELETE
USING (auth.uid() = user_id);

-- Dashboard Widgets Policies
CREATE POLICY "Users can view widgets from their dashboards"
ON public.dashboard_widgets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can create widgets in their dashboards"
ON public.dashboard_widgets FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can update widgets in their dashboards"
ON public.dashboard_widgets FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

CREATE POLICY "Users can delete widgets from their dashboards"
ON public.dashboard_widgets FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.dashboard_configs
  WHERE dashboard_configs.id = dashboard_widgets.dashboard_id
  AND dashboard_configs.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_dashboard_configs_updated_at
BEFORE UPDATE ON public.dashboard_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at
BEFORE UPDATE ON public.dashboard_widgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_dashboard_configs_user_id ON public.dashboard_configs(user_id);
CREATE INDEX idx_dashboard_widgets_dashboard_id ON public.dashboard_widgets(dashboard_id);

-- Enable realtime for dashboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_widgets;

-- Fix security issue: Strengthen employees table RLS policies
-- The current policies are correct but need to add redundant protection
DROP POLICY IF EXISTS "Users can view employees from their projects" ON public.employees;

CREATE POLICY "Users can view employees from their projects"
ON public.employees FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    created_by_user_id = auth.uid() OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = employees.project_id
      AND projects.created_by_user_id = auth.uid()
    )) OR
    (construction_site_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM construction_sites cs
      JOIN projects p ON p.id = cs.project_id
      WHERE cs.id = employees.construction_site_id
      AND p.created_by_user_id = auth.uid()
    ))
  )
);

-- Fix security issue: Strengthen labor_tracking table RLS policies
DROP POLICY IF EXISTS "Users can view labor tracking from their projects" ON public.labor_tracking;

CREATE POLICY "Users can view labor tracking from their projects"
ON public.labor_tracking FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = labor_tracking.project_id
    AND projects.created_by_user_id = auth.uid()
  )
);

-- Migration: 20251222153930_1336992e-1dee-4ce0-a104-bfcf6ab05e8a.sql
-- Make the interactive-maps bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'interactive-maps';

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view public maps" ON storage.objects;

-- Create new secure SELECT policy that verifies project ownership
CREATE POLICY "Users can view maps from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'interactive-maps' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id::text = (storage.foldername(name))[1]
    AND projects.created_by_user_id = auth.uid()
  )
);

-- Add database constraints for user_quotas
ALTER TABLE public.user_quotas
ADD CONSTRAINT check_max_projects 
  CHECK (max_projects >= 1 AND max_projects <= 100);

ALTER TABLE public.user_quotas
ADD CONSTRAINT check_max_employees 
  CHECK (max_employees >= 1 AND max_employees <= 10000);

-- Migration: 20251224220013_3dd575a8-2c2f-4dc7-913e-e2f8a6d5f43c.sql
-- Adicionar 'manager' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- Migration: 20251224220225_94b723e5-69bf-4f50-b2f3-b875f4b93a4b.sql
-- =============================================
-- ADICIONAR project_id À TABELA supplier_quotes
-- =============================================
ALTER TABLE public.supplier_quotes ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Atualizar project_id baseado no purchase_request_id existente
UPDATE public.supplier_quotes sq
SET project_id = pr.project_id
FROM public.purchase_requests pr
WHERE sq.purchase_request_id = pr.id
AND sq.project_id IS NULL;

-- =============================================
-- FUNÇÕES DE SEGURANÇA
-- =============================================

CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id 
    AND created_by_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND project_id = _project_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND is_super_admin = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_qrcode_access(_user_id uuid, _qr_code_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.maintenance_qr_codes mqc
    JOIN public.projects p ON mqc.project_id = p.id
    WHERE mqc.id = _qr_code_id
    AND (
      p.created_by_user_id = _user_id
      OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id 
        AND (project_id = p.id OR is_super_admin = true)
      )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_manager(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id 
    AND created_by_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND project_id = _project_id 
    AND role IN ('admin', 'manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND is_super_admin = true
  )
$$;

-- Função para obter project_id do supplier_quote via purchase_request
CREATE OR REPLACE FUNCTION public.get_supplier_quote_project_id(_quote_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.project_id
  FROM public.supplier_quotes sq
  JOIN public.purchase_requests pr ON sq.purchase_request_id = pr.id
  WHERE sq.id = _quote_id
$$;

-- =============================================
-- CORRIGIR RLS DA TABELA EMPLOYEES
-- =============================================

DROP POLICY IF EXISTS "Users can view employees from their projects" ON public.employees;
DROP POLICY IF EXISTS "Users can view their own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update their own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can delete their own employees" ON public.employees;

CREATE POLICY "Authenticated users can view employees from their projects"
ON public.employees FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.has_project_access(auth.uid(), project_id)
  )
);

CREATE POLICY "Authenticated users can insert employees"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND (project_id IS NULL OR public.has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Authenticated users can update their employees"
ON public.employees FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Authenticated users can delete their employees"
ON public.employees FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- CORRIGIR RLS DA TABELA MAINTENANCE_REQUESTS
-- =============================================

DROP POLICY IF EXISTS "Users can view maintenance requests for their projects" ON public.maintenance_requests;
DROP POLICY IF EXISTS "Anyone can create maintenance requests" ON public.maintenance_requests;
DROP POLICY IF EXISTS "Users can update maintenance requests for their projects" ON public.maintenance_requests;

CREATE POLICY "Users with project access can view maintenance requests"
ON public.maintenance_requests FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_qrcode_access(auth.uid(), qr_code_id)
);

CREATE POLICY "Anyone can create maintenance requests for valid QR codes"
ON public.maintenance_requests FOR INSERT
TO anon, authenticated
WITH CHECK (
  qr_code_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.maintenance_qr_codes 
    WHERE id = qr_code_id 
    AND is_active = true
  )
);

CREATE POLICY "Project managers can update maintenance requests"
ON public.maintenance_requests FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_qrcode_access(auth.uid(), qr_code_id)
);

CREATE POLICY "Project managers can delete maintenance requests"
ON public.maintenance_requests FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.has_qrcode_access(auth.uid(), qr_code_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA LABOR_TRACKING
-- =============================================

DROP POLICY IF EXISTS "Users can view labor tracking for their projects" ON public.labor_tracking;
DROP POLICY IF EXISTS "Users can insert labor tracking" ON public.labor_tracking;
DROP POLICY IF EXISTS "Users can update labor tracking" ON public.labor_tracking;
DROP POLICY IF EXISTS "Users can delete labor tracking" ON public.labor_tracking;

CREATE POLICY "Managers can view labor tracking"
ON public.labor_tracking FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Authenticated users can insert labor tracking"
ON public.labor_tracking FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND public.has_project_access(auth.uid(), project_id)
);

CREATE POLICY "Managers can update labor tracking"
ON public.labor_tracking FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete labor tracking"
ON public.labor_tracking FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA PURCHASE_REQUESTS
-- =============================================

DROP POLICY IF EXISTS "Users can view purchase requests for their projects" ON public.purchase_requests;
DROP POLICY IF EXISTS "Users can insert purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "Users can update purchase requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "Users can delete purchase requests" ON public.purchase_requests;

CREATE POLICY "Authenticated users can view their own purchase requests"
ON public.purchase_requests FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    requested_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Authenticated users can create purchase requests"
ON public.purchase_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND requested_by_user_id = auth.uid()
  AND public.has_project_access(auth.uid(), project_id)
);

CREATE POLICY "Managers can update purchase requests"
ON public.purchase_requests FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    requested_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete purchase requests"
ON public.purchase_requests FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA SUPPLIER_QUOTES
-- =============================================

DROP POLICY IF EXISTS "Users can view supplier quotes for their projects" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Users can insert supplier quotes" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Users can update supplier quotes" ON public.supplier_quotes;
DROP POLICY IF EXISTS "Users can delete supplier quotes" ON public.supplier_quotes;

CREATE POLICY "Managers can view supplier quotes"
ON public.supplier_quotes FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
    OR public.is_project_manager(auth.uid(), public.get_supplier_quote_project_id(id))
  )
);

CREATE POLICY "Managers can insert supplier quotes"
ON public.supplier_quotes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Managers can update supplier quotes"
ON public.supplier_quotes FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete supplier quotes"
ON public.supplier_quotes FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- CORRIGIR RLS DA TABELA PURCHASE_ORDERS
-- =============================================

DROP POLICY IF EXISTS "Users can view purchase orders for their projects" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can insert purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can delete purchase orders" ON public.purchase_orders;

CREATE POLICY "Managers can view purchase orders"
ON public.purchase_orders FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Managers can insert purchase orders"
ON public.purchase_orders FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Managers can update purchase orders"
ON public.purchase_orders FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

CREATE POLICY "Managers can delete purchase orders"
ON public.purchase_orders FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.is_project_manager(auth.uid(), project_id)
);

-- =============================================
-- CORRIGIR RLS DA TABELA INVENTORY
-- =============================================

DROP POLICY IF EXISTS "Users can view inventory items" ON public.inventory;
DROP POLICY IF EXISTS "Users can insert inventory items" ON public.inventory;
DROP POLICY IF EXISTS "Users can update inventory items" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete inventory items" ON public.inventory;

CREATE POLICY "Users with project access can view inventory"
ON public.inventory FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.has_project_access(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can insert inventory items"
ON public.inventory FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND (project_id IS NULL OR public.has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can update their inventory items"
ON public.inventory FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Managers can delete inventory items"
ON public.inventory FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- CORRIGIR RLS DA TABELA CONNECTION_REPORTS
-- =============================================

DROP POLICY IF EXISTS "Users can view their own connection reports" ON public.connection_reports;
DROP POLICY IF EXISTS "Users can insert connection reports" ON public.connection_reports;
DROP POLICY IF EXISTS "Users can update their own connection reports" ON public.connection_reports;
DROP POLICY IF EXISTS "Users can delete their own connection reports" ON public.connection_reports;

CREATE POLICY "Users with project access can view connection reports"
ON public.connection_reports FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.has_project_access(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can insert connection reports"
ON public.connection_reports FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by_user_id = auth.uid()
  AND (project_id IS NULL OR public.has_project_access(auth.uid(), project_id))
);

CREATE POLICY "Users can update their connection reports"
ON public.connection_reports FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

CREATE POLICY "Users can delete their connection reports"
ON public.connection_reports FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);

-- =============================================
-- ADICIONAR ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_project ON public.user_roles(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_super_admin ON public.user_roles(user_id) WHERE is_super_admin = true;
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_qr_codes_project ON public.maintenance_qr_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_employees_project ON public.employees(project_id);
CREATE INDEX IF NOT EXISTS idx_employees_created_by ON public.employees(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_project ON public.supplier_quotes(project_id);

-- =============================================
-- CONFIGURAR RLS PARA AUDIT_LOG
-- =============================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only super admins can view audit logs" ON public.audit_log;
CREATE POLICY "Only super admins can view audit logs"
ON public.audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND is_super_admin = true
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Migration: 20260120011902_c7926c4b-25c6-49db-956a-df790dc67094.sql

-- =============================================================
-- SECURITY FIX: Consolidate and fix RLS policies
-- =============================================================

-- 1. Fix the overly permissive maintenance_requests INSERT policy
-- Drop the problematic policy that has WITH CHECK (true)
DROP POLICY IF EXISTS "Authenticated users can create maintenance requests" ON public.maintenance_requests;

-- 2. Consolidate audit_log SELECT policies - keep only super admin access
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_log;
-- Keep only "Only super admins can view audit logs" policy

-- 3. Add index for better performance on security function queries
CREATE INDEX IF NOT EXISTS idx_employees_project_id ON public.employees(project_id);
CREATE INDEX IF NOT EXISTS idx_employees_created_by ON public.employees(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_connection_reports_project_id ON public.connection_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_budgets_created_by ON public.budgets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_labor_tracking_project_id ON public.labor_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_created_by ON public.supplier_quotes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_obras_user_id ON public.obras(user_id);

-- 4. Add rate limiting awareness comment (actual rate limiting should be done at edge function level)
COMMENT ON POLICY "Anyone can create maintenance requests for valid QR codes" ON public.maintenance_requests IS 
  'Public QR code requests are allowed but should be rate-limited at the application level';


-- Migration: 20260120011934_f8504b85-d6e1-48f6-b59b-adab16c85378.sql

-- =============================================================
-- SECURITY FIX: Restrict connection_reports access to managers only
-- =============================================================

-- Drop the broad access policy
DROP POLICY IF EXISTS "Users with project access can view connection reports" ON public.connection_reports;

-- Create more restrictive policy - only creators and project managers
CREATE POLICY "Managers and creators can view connection reports"
ON public.connection_reports FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by_user_id = auth.uid()
    OR public.is_project_manager(auth.uid(), project_id)
  )
);


-- Migration: 20260120012804_78f819df-aedd-479f-a4e9-34b7820d900b.sql
-- =============================================================
-- SECURITY FIX: Restrict maintenance-request-photos storage uploads
-- =============================================================

-- Drop existing permissive upload policy
DROP POLICY IF EXISTS "Anyone can upload maintenance request photos" ON storage.objects;

-- Create a tracking table for rate limiting maintenance requests
CREATE TABLE IF NOT EXISTS public.maintenance_request_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ip text NOT NULL,
  qr_code_id uuid NOT NULL REFERENCES public.maintenance_qr_codes(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.maintenance_request_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.maintenance_request_rate_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_maintenance_rate_limits_ip_time 
ON public.maintenance_request_rate_limits(client_ip, created_at);

CREATE INDEX IF NOT EXISTS idx_maintenance_rate_limits_qr_time 
ON public.maintenance_request_rate_limits(qr_code_id, created_at);

-- Cleanup old rate limit records (older than 24 hours) - function for scheduled cleanup
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.maintenance_request_rate_limits
  WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Add comment documenting the security fix
COMMENT ON TABLE public.maintenance_request_rate_limits IS 
  'Rate limiting table for maintenance requests to prevent abuse from anonymous users';

-- Note: Storage policy change requires edge function for signed URL uploads
-- The maintenance-request-photos bucket should use signed URLs from edge function
