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