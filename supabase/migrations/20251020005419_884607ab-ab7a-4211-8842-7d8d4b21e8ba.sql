-- Create material_requests table
CREATE TABLE public.material_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  project_id UUID NOT NULL,
  service_front_id UUID NOT NULL,
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  requested_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on material_requests
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for material_requests
CREATE POLICY "Usuários autenticados podem ver pedidos de material"
ON public.material_requests
FOR SELECT
USING (true);

CREATE POLICY "Usuários autenticados podem criar pedidos de material"
ON public.material_requests
FOR INSERT
WITH CHECK (auth.uid() = requested_by_user_id);

CREATE POLICY "Usuários podem atualizar pedidos que criaram"
ON public.material_requests
FOR UPDATE
USING (auth.uid() = requested_by_user_id);

CREATE POLICY "Usuários podem deletar pedidos que criaram"
ON public.material_requests
FOR DELETE
USING (auth.uid() = requested_by_user_id);

-- Create material_control table
CREATE TABLE public.material_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_name TEXT NOT NULL,
  project_id UUID NOT NULL,
  service_front_id UUID NOT NULL,
  quantity_used NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on material_control
ALTER TABLE public.material_control ENABLE ROW LEVEL SECURITY;

-- RLS Policies for material_control
CREATE POLICY "Usuários autenticados podem ver controle de material"
ON public.material_control
FOR SELECT
USING (true);

CREATE POLICY "Usuários autenticados podem criar registros de controle"
ON public.material_control
FOR INSERT
WITH CHECK (auth.uid() = recorded_by_user_id);

CREATE POLICY "Usuários podem atualizar registros que criaram"
ON public.material_control
FOR UPDATE
USING (auth.uid() = recorded_by_user_id);

CREATE POLICY "Usuários podem deletar registros que criaram"
ON public.material_control
FOR DELETE
USING (auth.uid() = recorded_by_user_id);

-- Add updated_at trigger for material_requests
CREATE TRIGGER update_material_requests_updated_at
BEFORE UPDATE ON public.material_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for material_control
CREATE TRIGGER update_material_control_updated_at
BEFORE UPDATE ON public.material_control
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();